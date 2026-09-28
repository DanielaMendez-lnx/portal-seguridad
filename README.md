# Umbra Radar

> An open catalog of attack techniques, the controls they map to, and the detection rules that cover them, with the provenance of every mapping always visible.

https://portal-seguridad-chi.vercel.app/



!\[License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
!\[Status](https://img.shields.io/badge/status-MVP%20in%20development-4fd8ff.svg)

!\[Umbra Radar home page](docs/img/home.png)

## What is this?

Checking whether a detection rule lines up with a framework such as MITRE ATT\&CK or NIST SP 800-53, and how much you can trust that mapping, usually means cross-referencing several websites by hand.

Umbra Radar brings those sources into one place, organized by technical domain. For each attack technique you can see the NIST controls mapped to it, the community detection rules that cover it, and recent CVEs, and every mapping shows **where it comes from and how reliable that source is**.

It is aimed at small and medium-sized businesses (SMBs) that want to improve the security of their systems but do not have a dedicated compliance or threat-intelligence team, and at the junior SIEM/SOC engineers and learners who work with detection rules day to day.

!\[Network Infrastructure dashboard](docs/img/dashboard.png)

## What you can do today

* **Browse by domain.** The first active domain is *Network Infrastructure \& Protocols*.
* **See ATT\&CK techniques with their NIST SP 800-53 controls**, each with a provenance badge (Official / Community).
* **See detection rules from SigmaHQ** for each technique, with a link to the original rule file.
* **Follow recent CVEs from NVD**, with a monthly disclosure chart (6 months / 1 year) and paginated, expandable entries.
* **Build a personal repertoire.** Star individual rules, group them by domain and technique, and export the selection as a Markdown file. No account needed: everything stays in your browser (`localStorage`).

!\[Repertoire export](docs/img/repertorio.png)

## How trust works

Not every mapping is equally reliable, and the interface does not pretend otherwise.

|Label|Meaning|Example|
|-|-|-|
|Official|Published by the framework maintainers or a government body|ATT\&CK ↔ NIST 800-53 mappings from CTID|
|Community|Written by the open-source community; review before use|SigmaHQ detection rules|

A third label, *Own*, is reserved for mappings curated by this project.

Some techniques show **"no direct mapping available"**. That is intentional: it means no published mapping exists for that combination, not that data is missing.

Umbra Radar is an informational aid, not a compliance tool. Always validate a rule in your own environment before deploying it.

## Data sources

|Source|Used for|Terms|
|-|-|-|
|[MITRE ATT\&CK®](https://attack.mitre.org/)|Techniques and tactics|[ATT\&CK Terms of Use](https://attack.mitre.org/resources/legal-and-branding/terms-of-use/)|
|[CTID Mappings Explorer](https://github.com/center-for-threat-informed-defense/mappings-explorer)|NIST SP 800-53 Rev. 5 controls and their mapping to techniques|Apache 2.0|
|[SigmaHQ](https://github.com/SigmaHQ/sigma)|Detection rule metadata; each rule links to its upstream file|[DRL 1.1](https://github.com/SigmaHQ/Detection-Rule-License)|
|[NVD](https://nvd.nist.gov/)|CVEs, severity and dates|[API Terms of Use](https://nvd.nist.gov/developers/terms-of-use)|
|[CISA advisories](https://www.cisa.gov/)|Ingested by the pipeline; not shown in the interface yet|U.S. Government works (public domain)|

## Roadmap

* \[x] Network Infrastructure \& Protocols
* \[ ] Endpoint \& Host Security (next)
* \[ ] Identity \& Access Management
* \[ ] Cloud \& IaaS Infrastructure
* \[ ] Web Applications \& APIs
* \[ ] OT/ICS, someday

Other ideas: show rule authorship, and surface CISA advisories once enough relevant ones accumulate.

## How it works

```
MITRE ATT\\\\\\\&CK · CTID · SigmaHQ · NVD · CISA
        │   Python ETL scripts, scheduled with GitHub Actions
        ▼
PostgreSQL (Neon) ──▶ FastAPI (Render) ──▶ Next.js (Vercel)
```

* **Backend:** Python, FastAPI, SQLAlchemy (synchronous), Alembic migrations, rate limiting with slowapi.
* **Database:** PostgreSQL on Neon.
* **Frontend:** Next.js, React, Tailwind CSS, Recharts.
* **Data pipelines:** one script per source in `backend/etl/`. The workflows in `.github/workflows/` run the NVD data daily and the other sources on a slower schedule.
* **Cost:** everything runs on free tiers. After a period of inactivity the first visit can take up to about a minute while the services wake up; a loading screen shows while that happens.

## Run it locally

You need Python 3.11+, Node.js (LTS) and a PostgreSQL database (a free Neon project works).

```bash
git clone https://github.com/DanielaMendez-lnx/portal-seguridad.git
cd portal-seguridad
```

**Backend**

```bash
cd backend
python -m venv venv
venv\\\\\\\\Scripts\\\\\\\\activate          # Windows. On macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env`:

```
DATABASE\\\\\\\_URL=<your PostgreSQL connection string>
NVD\\\\\\\_API\\\\\\\_KEY=                   # optional, raises the NVD rate limit
ENVIRONMENT=development
```

Create the tables and load the data (the order matters: techniques must exist before the mappings):

```bash
alembic upgrade head
python etl/ingest\\\\\\\_mitre.py
python etl/ingest\\\\\\\_ctid.py
python etl/ingest\\\\\\\_sigma.py
python etl/ingest\\\\\\\_nvd.py --modo backfill
python etl/ingest\\\\\\\_cisa.py
uvicorn app.main:app --reload
```

The API is now at http://127.0.0.1:8000 with interactive docs at `/docs`.

**Frontend**

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```
NEXT\\\\\\\_PUBLIC\\\\\\\_API\\\\\\\_URL=http://127.0.0.1:8000
```

```bash
npm run dev
```

Open http://localhost:3000.

**Tests and linting** (from the repository root, with the virtual environment active):

```bash
pytest backend/tests
ruff check backend
```

The UPSERT idempotency test runs against the database in `DATABASE\\\\\\\_URL`, inside a transaction that is always rolled back.

## Deployment notes

* The backend runs on Render and the frontend on Vercel. In production, set `ENVIRONMENT=production` and `ALLOWED\\\\\\\_ORIGINS` (your frontend URL) on the backend, and `NEXT\\\\\\\_PUBLIC\\\\\\\_API\\\\\\\_URL` on the frontend.
* The GitHub Actions workflows need the repository secrets `DATABASE\\\\\\\_URL` and `NVD\\\\\\\_API\\\\\\\_KEY`.

## Contributing

Issues and pull requests are welcome. Feedback is especially valuable from people who write or maintain detection rules: is the provenance model useful in practice, and which domain should come next?

## License and attributions

The source code is licensed under the [Apache License 2.0](LICENSE). Third-party data (ATT\&CK, NVD, CTID mappings, SigmaHQ rules, CISA advisories) keeps its original license and terms of use; see [NOTICE](NOTICE) for the full attributions.

Umbra Radar is an independent project. It is not affiliated with or endorsed by MITRE, NIST, CISA or SigmaHQ.



