$port = 8181
$path = "D:\northwide-traders-website"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
Write-Output "HTTP Server running at http://localhost:$port/"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $urlPath = $request.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($urlPath)) { $urlPath = "index.html" }
        $filePath = Join-Path $path $urlPath

        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".png"  { "image/png" }
                ".svg"  { "image/svg+xml" }
                default { "application/octet-stream" }
            }
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        $response.OutputStream.Close()
    } catch {
        # continue handling requests
    }
}
