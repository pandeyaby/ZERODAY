# Getting started

```bash
npm install

# Keyless default
npm run zeroday -- operate --cwe CWE-89 --fixture
npm run zeroday -- verify --from zeroday-reports/operate-CWE-89-*   # or exact run dir

# Antares fixture recording
npm run zeroday -- locate --cwe CWE-89 --fixture

# Local playground UI
npm run play
# → http://localhost:3333/play
```

Read [`SCOPE_AND_AUTHORIZATION.md`](../SCOPE_AND_AUTHORIZATION.md) before assessing any repo you do not own.
