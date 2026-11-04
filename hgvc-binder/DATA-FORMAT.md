# HGVC Binder data file

The scheduled Claude task writes `Claude - HGVC Binder Data YYYY-MM-DD HHMM.json` to your Dropbox folder. The app loads the newest one.
It must never contain a password, a full contract/member/reservation number (last 4 digits only), card numbers, or a Hilton Honors member number (the Honors points balance and tier are fine).

```json
{
  "app": "HGVC Binder", "schema": 1, "asOf": "YYYY-MM-DD", "generated": "ISO time", "source": "HGV owner site, read-only (Claude)",
  "notes": ["anything the task couldn't read"],
  "honors": { "balance": 0, "tier": "Diamond", "asOf": "YYYY-MM-DD" },
  "properties": [{
    "id": "stable-slug", "name": "Resort name", "short": "Tab name", "location": "", "account": "HGVC | HGV Max",
    "currency": "ClubPoints | By Hilton Club points | HGV Max points", "unitType": "", "season": "",
    "homeWeeks": [{ "label": "", "points": 0 }], "purchaseDate": "YYYY-MM-DD", "ownership": "Deeded | Points only (trust) | Not sure",
    "checkInDay": "", "annualPoints": 0, "useYear": "January 1 – December 31", "contractLast4": "1234", "memberLast4": "1234",
    "batches": [{ "id": "stable", "label": "ClubPoints 2026", "year": 2026, "kind": "current | future | saved | borrowed | bonus",
                  "points": 0, "available": 0, "saved": 0, "borrowed": 0, "expires": "YYYY-MM-DD", "saveBy": "YYYY-MM-DD", "saveNote": "" }],
    "ledger": [{ "id": "stable", "date": "YYYY-MM-DD", "year": 2026, "type": "Allotment | Reservation | Saved points in | ...", "points": -100, "refLast4": "" }],
    "reservations": [{ "id": "stable", "resort": "", "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD", "unit": "", "points": 0, "via": "", "refLast4": "", "status": "Confirmed | Completed | Cancelled", "phone": "" }],
    "fees": [{ "id": "stable", "year": 2027, "label": "", "kind": "Maintenance fee | Club dues | Credit | Late fee | Other | Payment",
               "amount": 0.00, "due": "YYYY-MM-DD", "paid": false, "paidDate": "YYYY-MM-DD", "note": "" }],
    "contacts": [{ "id": "stable", "label": "", "phone": "" }]
  }]
}
```

Ids must stay the same from one run to the next so your edits in the app are kept. Items you add or edit in the app are never overwritten by a new data file.
