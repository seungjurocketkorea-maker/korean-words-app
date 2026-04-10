$files = @("index.html", "app.js", "style.css")
$replacements = @{
  "(?i)#FAF8F0" = "#fdf6e3"
  "(?i)#EAE6D6" = "#eee8d5"    
  "(?i)#E6E1CE" = "#fdf6e3"
  "(?i)#F5EFEA" = "#eee8d5"
  "(?i)#F5F2E6" = "#eee8d5"
  "(?i)#E0DBC5" = "#eee8d5"
  "(?i)#D6D2BF" = "#93a1a1"
  "(?i)#C4BFA6" = "#93a1a1"
  "(?i)#C47D57" = "#268bd2"
  "(?i)#8BA175" = "#859900"
  "(?i)#6A7B54" = "#2aa198"
  "(?i)#5C664C" = "#586e75"
  "(?i)#3B392E" = "#073642"
  "(?i)#84806A" = "#93a1a1"
  "(?i)#8A887A" = "#657b83"
  "(?i)#D98C63" = "#cb4b16"
  "(?i)#c37a53" = "#dc322f"
  "(?i)#b26942" = "#cb4b16"
  "\bbg-white\b" = "bg-[#fdf6e3]"
  "\btext-white\b" = "text-[#fdf6e3]"
}
foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8
        foreach ($key in $replacements.Keys) {
            $content = [regex]::Replace($content, $key, $replacements[$key])
        }
        Set-Content -Path $file -Value $content -Encoding UTF8
    }
}
