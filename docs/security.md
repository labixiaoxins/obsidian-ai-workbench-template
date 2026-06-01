# Publishing Safety

This project is designed to be publicable, but real user data is not.

Run a scan before pushing:

```bash
rg -n "api[_-]?key|token|secret|password|cookie|Bearer|Authorization|sk-[A-Za-z0-9]|/Users/|\\.env|auth\\.json|sessions|logs" .
```

Some documentation intentionally contains words like `token` and `logs`; inspect hits manually and distinguish safety guidance from real credentials.

