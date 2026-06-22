# API Contract

**Version:** v1.0
**Project:** {{PROJECT_NAME}}
**Created:** {{DATE}}
**Last Updated:** {{DATE}}
**Author:** #3 Planner + Chef

> This is the binding interface contract between Backend (#4) and Frontend (#5).
> Neither team implements anything that contradicts this contract.
> Changes require the Contract-Change Protocol — see [contract-change-protocol.md](contract-change-protocol.md).

---

## Changelog

| Version | Date | Changes | Breaking? | Committed |
|---------|------|---------|-----------|-----------|
| v1.0 | {{DATE}} | Initial contract | — | — |

---

## Base Configuration

```
Development:  http://localhost:{{PORT}}
Production:   {{PROD_URL}}
API Prefix:   /api/v1
```

---

## Authentication

- **Scheme:** Bearer Token / Session Cookie / API Key *(choose one)*
- **Header:** `Authorization: Bearer <token>`
- **Expiry:** {{EXPIRY}}
- **Refresh:** {{REFRESH_ENDPOINT}} *(if applicable)*

---

## Standard Response Formats

### Success

```json
{
  "data": {} // or []
}
```

### Error

```json
{
  "error": "MACHINE_READABLE_CODE",
  "message": "Human-readable description",
  "details": {} // optional, field-level validation errors
}
```

### Paginated List

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Standard HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (DELETE success) |
| 400 | Bad Request — invalid input |
| 401 | Unauthorized — missing/invalid auth |
| 403 | Forbidden — insufficient permissions |
| 404 | Not Found |
| 422 | Unprocessable Entity — validation error |
| 500 | Internal Server Error |

---

## Data Models

### {{ModelName}}

```typescript
interface {{ModelName}} {
  id: string;           // UUID v4
  {{field}}: {{type}};  // {{description}}
  createdAt: string;    // ISO 8601
  updatedAt: string;    // ISO 8601
}
```

### Shared Enums

```typescript
enum {{EnumName}} {
  {{VALUE_1}} = "{{value_1}}",
  {{VALUE_2}} = "{{value_2}}",
}
```

---

## Endpoints

### Authentication

#### `POST /auth/login`

**Auth required:** No

**Request:**
```json
{
  "email": "string (required, valid email)",
  "password": "string (required, min 8 chars)"
}
```

**Response 200:**
```json
{
  "data": {
    "token": "string",
    "expiresAt": "2024-01-15T10:30:00Z",
    "user": {
      "id": "string",
      "email": "string"
    }
  }
}
```

**Response 401:**
```json
{
  "error": "INVALID_CREDENTIALS",
  "message": "Email or password is incorrect"
}
```

---

#### `POST /auth/logout`

**Auth required:** Yes

**Response 204:** No content

---

### {{Resource}}

#### `GET /{{resource}}`

**Auth required:** Yes

**Query Parameters:**
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `page` | integer | No | 1 | Page number |
| `limit` | integer | No | 20 | Items per page (max: 100) |
| `{{filter}}` | {{type}} | No | — | {{description}} |

**Response 200:**
```json
{
  "data": [
    {
      "id": "string",
      "{{field}}": "{{type}}"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

---

#### `GET /{{resource}}/:id`

**Auth required:** Yes

**Path Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `id` | string (UUID) | Resource identifier |

**Response 200:**
```json
{
  "data": {
    "id": "string",
    "{{field}}": "{{type}}",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response 404:**
```json
{
  "error": "NOT_FOUND",
  "message": "{{Resource}} not found"
}
```

---

#### `POST /{{resource}}`

**Auth required:** Yes

**Request:**
```json
{
  "{{field}}": "{{type}}"
}
```

**Validation:**
| Field | Rules |
|-------|-------|
| `{{field}}` | Required, {{constraints}} |

**Response 201:**
```json
{
  "data": {
    "id": "string",
    "{{field}}": "{{type}}",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Response 422:**
```json
{
  "error": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": {
    "{{field}}": ["{{error_message}}"]
  }
}
```

---

#### `PUT /{{resource}}/:id`

**Auth required:** Yes

**Request:**
```json
{
  "{{field}}": "{{type}}"
}
```

**Response 200:** (updated resource, same shape as GET single)

**Response 404:** (same as GET single 404)

---

#### `DELETE /{{resource}}/:id`

**Auth required:** Yes

**Response 204:** No content

**Response 404:** (same as GET single 404)

---

## WebSocket Events (if applicable)

### Connection
```
ws://localhost:{{PORT}}/ws
Authorization: Bearer <token>  (via query param or first message)
```

### Server → Client Events
| Event | Payload Type | Description |
|-------|-------------|-------------|
| `{{event_name}}` | `{{PayloadInterface}}` | {{description}} |

### Client → Server Events
| Event | Payload Type | Description |
|-------|-------------|-------------|
| `{{event_name}}` | `{{PayloadInterface}}` | {{description}} |
