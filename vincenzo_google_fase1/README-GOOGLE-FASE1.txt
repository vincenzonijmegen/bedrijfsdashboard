GOOGLE BUSINESS PROFILE — FASE 1 (KOPPELING)
=============================================

Doel van deze fase:
- Google Business Profile technisch koppelen aan de Vincenzo-app.
- Het juiste profiel (IJssalon Vincenzo) selecteren.
- NOG GEEN openingstijden naar Google schrijven.

Waarom in twee fasen?
Google vereist eerst API-toegang en OAuth-toestemming. Pas nadat de koppeling aantoonbaar werkt, bouwen/testen we de synchronisatie van Winter / Maart / Zomer en incidentele sluiting.

1. GOOGLE CLOUD-PROJECT AANMAKEN
--------------------------------
Maak in Google Cloud een project aan, bijvoorbeeld:
  Vincenzo Business Profile

Gebruik hiervoor het Google-account dat eigenaar/beheerder is van het Google Business Profile van IJssalon Vincenzo.

2. BUSINESS PROFILE API-TOEGANG AANVRAGEN
-----------------------------------------
Google vereist een aparte aanvraag voor de Business Profile APIs.
In het formulier kies je:
  Application for Basic API Access

Je hebt het Project Number van stap 1 nodig.

3. NA GOEDKEURING: API'S INSCHAKELEN
------------------------------------
Minimaal nodig voor deze koppeling:
- My Business Account Management API
- My Business Business Information API

Google kan na goedkeuring meerdere Business Profile APIs beschikbaar maken.

4. OAUTH CLIENT MAKEN
---------------------
Google Cloud Console -> APIs & Services -> Credentials -> Create credentials -> OAuth client ID

Application type:
  Web application

Authorized redirect URI (PRODUCTIE):
  https://werkinstructies-app.vercel.app/api/google-business/callback

Maak daarna Client ID en Client Secret aan.

5. VERCEL ENVIRONMENT VARIABLES
-------------------------------
Voeg in Production toe:

GOOGLE_BUSINESS_CLIENT_ID=<client-id van Google>
GOOGLE_BUSINESS_CLIENT_SECRET=<client-secret van Google>

Daarna opnieuw deployen.

6. BESTANDEN IN DE APP
----------------------
Plaats/vervang:

app/admin/website/page.tsx
app/api/google-business/connect/route.ts
app/api/google-business/callback/route.ts
app/api/google-business/status/route.ts
app/api/google-business/location/route.ts
lib/googleBusiness.ts

7. TEST
------
Open:
  /admin/website

Bij Google Business Profile moet dan 'Google koppelen' staan.
Klik erop, log in met het Google-account dat Vincenzo beheert en geef toestemming.

Na terugkeer moet staan:
  Google-account gekoppeld

en het bedrijfsprofiel IJssalon Vincenzo moet geselecteerd kunnen worden.

PAS ALS DIT GROEN IS
--------------------
Daarna bouwen we fase 2: openingstijden synchroniseren vanuit dezelfde knop 'Opslaan & publiceren'.
