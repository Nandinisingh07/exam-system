$path = "C:\Users\Nandini singh\exam-system\frontend\src\pages\invigilator\Kiosk.jsx"
$bytes = [System.IO.File]::ReadAllBytes($path)
$content = [System.Text.Encoding]::UTF8.GetString($bytes)

$brokenDash = [string]::Join("", @([char]0x00E2, [char]0x0080, [char]0x009D))
$brokenEllipsis = [string]::Join("", @([char]0x00E2, [char]0x0080, [char]0x00A6))
$brokenBullet = [string]::Join("", @([char]0x00E2, [char]0x0080, [char]0x00A2))

$fixedDash = [char]0x2014
$fixedEllipsis = [char]0x2026
$fixedBullet = [char]0x2022

$content = $content.Replace($brokenDash, $fixedDash)
$content = $content.Replace($brokenEllipsis, $fixedEllipsis)
$content = $content.Replace($brokenBullet, $fixedBullet)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)

Write-Host "Done. Checking for leftovers:"
$check = Get-Content $path -Raw -Encoding UTF8
if ($check -match [char]0x00E2) {
    Write-Host "STILL BROKEN - matches found"
} else {
    Write-Host "CLEAN - no more broken characters"
}