// Fetch helper para todas las llamadas autenticadas del panel admin.
//
// Resuelve el problema de "no cargan los datos" en celular: el token JWT vive
// solo en localStorage de cada dispositivo y dura 12h. Cuando expira (o el
// JWT_SECRET del backend no coincide), el servidor responde 401 pero las
// páginas lo ignoraban silenciosamente y quedaban en blanco.
//
// adminFetch() adjunta el token y, ante un 401, borra el token vencido y
// manda al cajero a /admin/login para reingresar. Así nunca se queda la
// pantalla muerta sin explicación.

function readToken(): string {
  if (typeof window === 'undefined') return '';
  const t = localStorage.getItem('admin_token');
  // Defiende contra valores corruptos guardados por logins fallidos previos.
  if (!t || t === 'undefined' || t === 'null') return '';
  return t;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
  const next = encodeURIComponent(window.location.pathname || '/admin');
  // replace() para que el botón "atrás" no regrese a la pantalla muerta.
  window.location.replace(`/admin/login?next=${next}`);
}

/**
 * Igual que fetch(), pero:
 *  - Inyecta `Authorization: Bearer <admin_token>` (sin pisar headers propios).
 *  - Si la respuesta es 401, limpia la sesión y redirige a /admin/login.
 *
 * Devuelve la misma Response para que el llamador siga usando `res.ok`,
 * `res.json()`, etc. exactamente como antes.
 */
export async function adminFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = readToken();

  if (!token) {
    redirectToLogin();
    // Evita que el llamador procese una respuesta inexistente.
    throw new Error('SESSION_EXPIRED');
  }

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    redirectToLogin();
    throw new Error('SESSION_EXPIRED');
  }

  return res;
}
