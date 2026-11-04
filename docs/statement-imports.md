# Statement imports

Buddy Budget reads CSV and supported PDF statements in the browser. Raw statement files and PDF text are not uploaded or retained. Only transactions a user reviews and confirms are sent through the existing authenticated import operation.

## PDF support

The supported PDF layout is a text-based transaction table with date and description columns plus either one signed amount column or separate debit and credit columns. Common labels such as `Transaction description`, `Value date`, `Debit (R)`, `Credit (R)`, and `Amount (ZAR)` are recognised. Reference and running-balance columns are optional. Repeated page headers and description/reference text wrapped onto the next line are supported.

The importer does not use OCR. Scanned/image-only, encrypted, corrupted, mixed-layout, multi-account, or ambiguous multi-currency PDFs must be exported as CSV instead. PDF input is limited to 5 MiB, 50 pages, 20,000 text items, one million extracted characters, and bounded read operations. A preview and account selection are required before any write.

PDF rows enter the same normalization, exact-money validation, duplicate fingerprinting, categorisation preview, transactional import, and idempotent batch path as CSV rows. The database source remains `csv_import` for compatibility with that established pipeline; import metadata records `source_format` where supported.

For manual testing, use `e2e/fixtures/synthetic-supported-bank-statement-november-2026.pdf` with a November 2026 destination month and any test account. The document is conspicuously fictional, contains four transactions across two pages, repeats its column headings, and includes a wrapped description. Regenerate it with `node scripts/generate-synthetic-bank-statement.mjs`; the generator verifies its page count and required extracted text with PDF.js.

## Categorisation rules

Enabled rules are evaluated in their saved priority order. Description exact/contains matching ignores case and repeated whitespace. Optional conditions cover amount range, transaction type, date range, and weekdays. The first matching action for a field wins, while a later rule can fill a different field. The preview identifies the rules responsible for proposed field changes.

Manual edits do not create rules. Viewing the import help does not modify rules. Existing transactions change only when a user explicitly tests and applies rules from Settings.
