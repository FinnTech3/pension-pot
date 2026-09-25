# Sources

The gilt curves and mortality tables were downloaded on 24 September 2026, and
the annuity quotes and Retirement Living Standards were read from their pages
on 25 September 2026. Files in `data/sources` are committed as downloaded,
except the quotes, which are a table read from a web page.

## Committed

| File | Publisher and title | SHA-256 |
|---|---|---|
| `boe_glc_nominal_daily_2026_09.xlsx` | Bank of England, UK nominal gilt yield curve, daily, September 2026 (spot curve sheet), from `latest-yield-curve-data.zip` | `10e09cdda7ac38aedc4c63e1a3364c44ac246bcfd2bcd0a4547ec5d663b51d62` |
| `boe_glc_real_daily_2026_09.xlsx` | Bank of England, UK real gilt yield curve, daily, September 2026, from the same archive | `d2b3a08e182285a438badcddd2c5d30c9ef4d131e2f0a66b83eb14678835257a` |
| `boe_glc_real_month_end_1979_to_2015.xlsx` | Bank of England, UK real gilt yield curve, month ends, 1979 to 2015, from `glcrealmonthedata.zip` | `867b91700cdf24a05c21e39330ddd74e31384edb879def08d406eaae3be6face` |
| `boe_glc_real_month_end_2016_to_2024.xlsx` | as above, 2016 to 2024 | `d287feecb0082272a480fd02d1fb98ab4950456fad21ffef78535e9c199b33a3` |
| `boe_glc_real_month_end_2025_to_present.xlsx` | as above, 2025 to August 2026 | `3c395a06a73a6b79a25f60886ed633c5c405be1f9bc2ce1b844c8bdb83542240` |
| `ons_ukppp24qx.xlsx` | ONS, Mortality rates (qx), principal projection, UK, 2024-based | `fbc6991bbeeab2691e0e7ce6aabf697fbcbe341a84f8dba6d11f48b29f4e6dac` |
| `hl_best_buy_2026-09-17.csv` | Hargreaves Lansdown, best-buy annuity rates for 17 September 2026: all 30 standard quotes (six products at ages 55, 60, 65, 70 and 75), read from the page's table | `ca21b0269b8df7ff13a0ecb92f039a60f960bf32fb7c11e7f60299e3a52400bc` |

Addresses:

- Bank of England yield curves: https://www.bankofengland.co.uk/statistics/yield-curves
  - daily, current month: https://www.bankofengland.co.uk/-/media/boe/files/statistics/yield-curves/latest-yield-curve-data.zip (SHA-256 `4fc98b761b8433887cfabfbe832402bc2c73d9eb5305a1b704d9ad77f9b5bd06`)
  - real, month ends: https://www.bankofengland.co.uk/-/media/boe/files/statistics/yield-curves/glcrealmonthedata.zip (SHA-256 `3253fe39957d6ad0d59513ab66269faaa1388c11d8f1620bd70f936a43a1f94b`)
- ONS projected mortality: https://www.ons.gov.uk/file?uri=/peoplepopulationandcommunity/birthsdeathsandmarriages/lifeexpectancies/datasets/mortalityratesqxprincipalprojectionunitedkingdom/2024based/ukppp24qx.xlsx
- Hargreaves Lansdown best-buy rates: https://www.hl.co.uk/retirement/annuities/best-buy-rates. The page as read is not committed; its SHA-256 was `f8259396a092094c222c9f9940843038d01fb971200df15703e387c328f9df3e`. Its notes: quotes from HL's comparison of leading providers, an average postcode, paid monthly in advance, joint life with the spouse three years younger. The smoker column is left out.

## Figures typed in, and where from

| Figure | Value | Source |
|---|---|---|
| Retirement Living Standards, one person | £13,900, £32,700, £45,400 | Pensions UK with Loughborough University's Centre for Research in Social Policy, update of 3 June 2026: https://www.retirementlivingstandards.org.uk/news/2026-rls-update |
| Retirement Living Standards, two people | £22,500, £45,400, £62,700 | as above |
| Full new state pension, 2026-27 | £241.30 a week, £12,548 a year | GOV.UK, benefit and pension rates 2026 to 2027 |
| Personal allowance, basic rate limit | £12,570, £50,270, frozen to April 2031 | GOV.UK, income tax rates and allowances |

## Traps, and what was done about them

- **Two sets of standards.** The standards were updated on 3 June 2026. An
  earlier version of this project used the 2025 figures; see the README.
- **No London standards in 2026.** Earlier releases published separate London
  figures; the 2026 release does not, so there is no London option.
- **The real curve starts at 2.5 years.** Blank cells in the Bank's sheets are
  maturities it does not publish, not zeros. Beyond the last published
  maturity the curve is held flat.
- **The history needs 5 to 20 years.** Months where the real curve does not
  span that range are skipped rather than extrapolated. From 2005 every month
  qualifies.
- **Mortality per 100,000.** The ONS publishes qx per 100,000, not as a
  probability. A test checks the loader divides.
- **Quotes read through a summary.** The quotes were first read through a tool
  that summarises pages, which is not good enough for numbers a check rests
  on. They were read again from the raw page, all 30 cells, and the six
  originally used matched.

## What I tried and could not use

- **The PPI's technical report for the standards.** I planned to reproduce its
  pot sizes as a second check, but the report does not publish them.
- **Past annuity quotes.** I looked for citable best-buy tables from 2021 to
  check the history against and found none that could be read by a script or
  cited reliably, so the history is presented as what gilt yields alone did.

## Licences

Bank of England and ONS data: Open Government Licence v3.0. The Retirement
Living Standards and Hargreaves Lansdown's rates are quoted as published, with
attribution.
