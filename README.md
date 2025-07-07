# Atra-Proxy

## REST API

### /search

- `GET /search?query=bitcoin&maxResults=10`
- Returns: `{ status: 'SUCCESS', data: [...] }`

Example:

```sh
curl 'http://localhost:8080/search?query=bitcoin&maxResults=10'
```