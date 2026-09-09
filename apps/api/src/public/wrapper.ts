function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildCsp(publicBaseUrl: string): string {
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline' https:",
    'img-src * data:',
    'font-src * data:',
    `connect-src ${publicBaseUrl}/api/public/`,
    "frame-src 'self'",
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
}

export function buildWrapperPage(opts: { title: string; srcdoc: string }): string {
  const title = escapeHtml(opts.title);
  const srcdoc = escapeHtml(opts.srcdoc);
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0">
<iframe sandbox="allow-scripts allow-forms" srcdoc="${srcdoc}" style="border:0;width:100%;height:100vh"></iframe>
</body>
</html>`;
}
