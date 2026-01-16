# Setup Guide: Uleste Innsjekk-notifikasjoner

## Oversikt
Denne funksjonen gir deg som coach en rød badge med antall uleste innsjekk på hver klient i dashbordet. Badgen vises automatisk når klienter sender inn nye rapporter, og forsvinner når du åpner klienten.

## Steg 1: Database-migrering (VIKTIG!)

Før du kan bruke funksjonen, må du legge til en ny kolonne i databasen.

### Kjør dette i Neon Database Console:

```sql
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;
```

**Valgfritt:** Hvis du vil markere alle eksisterende innsjekk som lest:
```sql
UPDATE checkins SET is_read = TRUE;
```

## Steg 2: Deploy endringene

Etter at du har kjørt SQL-kommandoen over, er alt klart!

```bash
git add .
git commit -m "Legg til notifikasjoner for uleste innsjekk"
git push
```

## Hvordan det fungerer

1. **Når en klient sender inn rapport**: Innsjekken lagres med `is_read = false`
2. **I coach-dashbordet**: Alle klienter med uleste innsjekk viser en rød badge med antallet
3. **Når du åpner en klient**: Alle deres innsjekk markeres automatisk som lest, og badgen forsvinner

## Hva er endret

### Backend:
- `netlify/functions/users.js`: Returnerer nå `unreadCheckins` per klient
- `netlify/functions/data.js`:
  - Returnerer `isRead` felt på innsjekk
  - Ny funksjon: `mark_checkins_read` for å markere som lest

### Frontend:
- `index.html`:
  - Ny API-funksjon: `api.markCheckinsRead(userId)`
  - CoachDashboard viser rød badge med antall uleste
  - Automatisk markering som lest når coach åpner klient

## Feilsøking

Hvis badgen ikke vises:
1. Sjekk at SQL-kommandoen ble kjørt uten feil
2. Sjekk at kolumnen ble lagt til: `SELECT * FROM checkins LIMIT 1;`
3. Test ved å sende inn en ny rapport som klient

## Fremtidige forbedringer (valgfritt)

- Vise antall uleste i header/notifikasjonsklokke
- Push-notifikasjoner når nye innsjekk kommer
- Markere individuelle innsjekk i stedet for alle på en gang
