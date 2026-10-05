$apiUrl = 'https://de.wikipedia.org/w/api.php?action=parse&page=Liste_der_Kfz-Kennzeichen_in_Deutschland&prop=wikitext&format=json&formatversion=2'
$req = Invoke-WebRequest -Uri $apiUrl -Headers @{ 'User-Agent' = 'Mozilla/5.0' } -UseBasicParsing
$json = $req.Content | ConvertFrom-Json
$wikiText = $json.parse.wikitext.'*'
$lines = $wikiText -split "`r?`n"
$lookup = @{}

for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    if ($line -notmatch "^\|\s*'''([^']+)'''\s*$") {
        continue
    }

    $code = $Matches[1].Trim()
    $derivation = $null

    for ($j = $i + 1; $j -lt [Math]::Min($lines.Count, $i + 18); $j++) {
        $cand = $lines[$j]
        if ($cand -match '^\|\s*-\s*$') { break }

        if ($cand -match '^\|\s*\[\[.*\|') {
            $m = [regex]::Match($cand, '\[\[([^\]|]+)\|')
            if ($m.Success) {
                $derivation = $m.Groups[1].Value.Trim()
                break
            }
        }

        if ($cand -match '^\|\s*\[\[.*\]\]') {
            $m = [regex]::Match($cand, '\[\[([^\]|]+)\]\]')
            if ($m.Success) {
                $derivation = $m.Groups[1].Value.Trim()
                break
            }
        }
    }

    if ($derivation) {
        $lookup[$code] = $derivation
    }
}

$raw = Get-Content -Path '.\plate-data.js' -Raw
$jsonText = $raw.Replace('window.PLATE_DATA = ', '').TrimEnd(';')
$data = $jsonText | ConvertFrom-Json

foreach ($stateName in $data.PSObject.Properties.Name) {
    foreach ($entry in $data.$stateName) {
        $code = [string]$entry.code
        if ($lookup.ContainsKey($code)) {
            $entry.derivation = $lookup[$code]
        }
        elseif ($entry.regions.Count -gt 0) {
            $entry.derivation = $entry.regions[0]
        }
        else {
            $entry.derivation = $stateName
        }
    }
}

$output = "window.PLATE_DATA = " + ($data | ConvertTo-Json -Depth 20 -Compress) + ';'
Set-Content -Path '.\plate-data.js' -Value $output -Encoding UTF8

Write-Host "Updated entries: $($data.PSObject.Properties.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum"
Write-Host "Sample: BL=$($lookup['BL']) MOS=$($lookup['MOS']) AIC=$($lookup['AIC']) ZW=$($lookup['ZW']) WÜ=$($lookup['WÜ']) FÜS=$($lookup['FÜS'])"
