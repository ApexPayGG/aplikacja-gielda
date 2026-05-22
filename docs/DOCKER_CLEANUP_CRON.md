# Docker cleanup — runbook VPS (produkcja)

Operacyjna procedura czyszczenia Dockera na VPS, żeby dysk `/dev/sda1` nie zapełniał się ponownie do 100%.  
**Ten dokument nie modyfikuje crontaba ani compose — tylko opisuje kroki do ręcznego wdrożenia.**

---

## 1. Problem

| Źródło | Skutek |
|--------|--------|
| Nieużywane **obrazy** Docker, **build cache**, **logi kontenerów** | Dysk `/dev/sda1` rośnie do 100% |
| Pełny dysk | Redis nie może zapisać **RDB** ani **AOF** → błąd `No space left on device`, **MISCONF** |
| Redis w stanie MISCONF | API może wejść w **restart loop** (healthcheck / zależności w `docker-compose.prod.yml`) |

Typowy objaw w logach Redis:

```text
MISCONF Redis is configured to save RDB snapshots...
No space left on device
```

Po incydencie `docker system prune` zwolnił ok. **9 GB** — bez regularnego czyszczenia problem wróci.

---

## 2. Bezpieczne komendy diagnostyczne (ręcznie)

Wykonuj na VPS jako użytkownik z dostępem do Dockera (np. root lub użytkownik w grupie `docker`).

```bash
# Ogólne zużycie dysku
df -h

# Podsumowanie miejsca zajętego przez Docker
docker system df

# Największe katalogi w /var/lib/docker (pomija błędy uprawnień)
du -h --max-depth=1 /var/lib/docker 2>/dev/null | sort -hr | head -20
```

**Interpretacja:**

- `df -h` — jeśli `/` lub `/dev/sda1` ≥ 90%, zaplanuj czyszczenie przed awarią.
- `docker system df` — widać Images / Containers / Local Volumes / Build Cache.
- `du` — pomaga znaleźć np. rozdmuchane logi overlay (rzadziej niż obrazy/cache).

---

## 3. Bezpieczne czyszczenie

Usuwa tylko **nieużywane** obrazy, zatrzymane kontenery, sieci i build cache **starsze niż 7 dni** (`168h`). **Nie dotyka wolumenów** ani działających kontenerów produkcyjnych.

```bash
docker system prune -af --filter "until=168h"
docker builder prune -af --filter "until=168h"
```

Po wykonaniu ponownie:

```bash
docker system df
df -h
```

---

## 4. Czego nie robić automatycznie

| Akcja | Dlaczego |
|-------|----------|
| `docker volume prune` w cronie | Może usunąć wolumeny uznane za „niepodłączone” — ryzyko utraty danych |
| Usuwanie wolumenów `postgres_data` / `redis_data` bez backupu | Utrata bazy i stanu Redis |
| `docker system prune` **bez** `--filter "until=..."` w cronie | Agresywniejsze; większe ryzyko przy nietypowym deployu |
| Czyszczenie plików w `/var/lib/docker` ręcznie (`rm -rf`) | Może uszkodzić warstwy i metadata Dockera |

**Zasada:** w cronie tylko `system prune` + `builder prune` z filtrem wieku. Wolumeny — wyłącznie świadoma decyzja po backupie i przeglądzie `docker volume ls`.

---

## 5. Propozycja crona (raz w tygodniu)

**Nie instalujemy crona z tego repozytorium** — administrator dodaje wpis ręcznie (`crontab -e`).

Przykład: niedziela 04:15, log do `/var/log/docker-cleanup.log`:

```cron
15 4 * * 0 docker system prune -af --filter "until=168h" >> /var/log/docker-cleanup.log 2>&1; docker builder prune -af --filter "until=168h" >> /var/log/docker-cleanup.log 2>&1; echo "--- $(date -Is) cleanup done ---" >> /var/log/docker-cleanup.log
```

Opcjonalnie przed pierwszym uruchomieniem crona:

```bash
sudo touch /var/log/docker-cleanup.log
sudo chmod 644 /var/log/docker-cleanup.log
```

Po pierwszym tygodniu sprawdź log:

```bash
tail -50 /var/log/docker-cleanup.log
df -h
```

---

## 6. Procedura po czyszczeniu (weryfikacja)

Z katalogu projektu na VPS (tam gdzie leży `docker-compose.prod.yml`):

```bash
df -h
docker ps
```

Sprawdzenie przez nginx (produkcja `stock-ai.pro`):

```bash
# Frontend / ogólna dostępność HTTPS
curl -I https://stock-ai.pro

# Health API — oba endpointy są skonfigurowane w nginx-prod.conf
curl -i https://stock-ai.pro/health
curl -i https://stock-ai.pro/api/health
```

Oczekiwane: HTTP **200**, body health z API (np. JSON ze statusem).

Jeśli coś nie odpowiada:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 redis api nginx
```

---

## 7. Procedura awaryjna — Redis MISCONF / brak miejsca na dysku

### Krok 1: Potwierdź przyczynę

```bash
df -h
docker logs stockai-redis-prod --tail=50
```

Jeśli dysk pełny lub prawie pełny → najpierw **zwolnij miejsce** (sekcja 3), potem restart usług.

### Krok 2: Zwolnij miejsce

```bash
docker system prune -af --filter "until=168h"
docker builder prune -af --filter "until=168h"
df -h
```

Upewnij się, że na `/` jest co najmniej kilkaset MB wolnego (Redis AOF/RDB potrzebuje miejsca na zapis).

### Krok 3: Wymuś odtworzenie kluczowych kontenerów

Z katalogu z `docker-compose.prod.yml`:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate redis api nginx
```

Poczekaj na healthchecki zależności (TimescaleDB + Redis muszą być healthy przed stabilnym API).

### Krok 4: Weryfikacja

```bash
docker compose -f docker-compose.prod.yml ps
docker logs stockai-redis-prod --tail=30
docker logs stockai-api-prod --tail=50
curl -i https://stock-ai.pro/api/health
```

Jeśli Redis nadal zgłasza MISCONF po zwolnieniu miejsca, sprawdź uprawnienia do wolumenu `redis_data` i czy proces redis ma miejsce na `/data` w kontenerze — **nie** usuwaj wolumenu bez backupu.

---

## Kontenery produkcyjne (referencja)

| Usługa | `container_name` |
|--------|------------------|
| TimescaleDB | `stockai-timescaledb-prod` |
| Redis | `stockai-redis-prod` |
| API | `stockai-api-prod` |
| Frontend | `stockai-frontend-prod` |
| Nginx | `stockai-nginx-prod` |

Plik compose: `docker-compose.prod.yml` (wolumeny: `postgres_data`, `redis_data`).

---

## Historia / kontekst incydentu

- Dysk `/dev/sda1` → 100% → Redis `No space left on device` → MISCONF.
- Jednorazowe `docker prune` zwolniło ~9 GB.
- Ten runbook + cotygodniowy cron (ręcznie dodany) mają zapobiec powtórce bez naruszania danych w wolumenach.
