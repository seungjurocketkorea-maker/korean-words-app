$files = @("index.html", "app.js")
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        $content = [regex]::Replace($content, "\bfont-bold\b", "font-medium")
        $content = [regex]::Replace($content, "\bfont-semibold\b", "font-medium")
        $content = [regex]::Replace($content, "AI 단어장 마스터", "AI 한국어 단어 1,000")
        Set-Content -Path $file -Value $content -Encoding UTF8
    }
}
