param([Parameter(Mandatory = $true)][string]$Password, [string]$BaseUrl = 'http://localhost:8888')
$ErrorActionPreference = 'Stop'

function Assert-Check($Condition, $Message) {
    if (-not $Condition) { throw $Message }
    Write-Output ('PASS ' + $Message)
}
function Read-MapApi($Path) {
    $response = Invoke-WebRequest -Uri ($BaseUrl + $Path) -WebSession $script:PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
    if ($response.StatusCode -ne 200) { throw ('API failed: ' + $Path + ' (' + $response.StatusCode + ')') }
    return ($response.Content | ConvertFrom-Json)
}
function Write-TestMap($Payload) {
    $response = Invoke-WebRequest -Uri ($BaseUrl + '/api/population/map/save') -Method Post -ContentType 'application/json' -Body ($Payload | ConvertTo-Json -Depth 6) -WebSession $script:PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
    if ($response.StatusCode -ne 200) { throw ('Save failed: ' + $response.Content) }
    return ($response.Content | ConvertFrom-Json)
}

foreach ($path in @('/api/population/map/load', '/api/population/map/versions/list', '/api/population/map/color-config/latest', '/api/population/estat?level=pref')) {
    $response = Invoke-WebRequest -Uri ($BaseUrl + $path) -UseBasicParsing -SkipHttpErrorCheck
    Assert-Check ($response.StatusCode -eq 401) ('unauthenticated access denied: ' + $path)
}
$login = Invoke-WebRequest -Uri ($BaseUrl + '/api/loginverify') -Method Post -ContentType 'application/json' -Body (@{ password = $Password } | ConvertTo-Json) -UseBasicParsing -SessionVariable PopulationTestSession
Assert-Check (($login.Content | ConvertFrom-Json).success) 'signed-cookie login'
$sessionCheck = Read-MapApi '/api/loginverify'
Assert-Check $sessionCheck.loggedIn 'cookie verifies on server'
$before = Read-MapApi '/api/population/map/versions/list'
$versionId = $null
$testName = '__codex_population_test_' + [Guid]::NewGuid().ToString('N')
try {
    $payload = @{
        versionName = $testName
        selectedAreas = @('13101', '14101')
        areaColors = @{ '13101' = 'color1'; '14101' = 'color2' }
        colorNames = @{ color1 = 'test red'; color2 = 'test green' }
        selectedPref = '13'
        prefMuniMapping = @{ '13' = @('13101'); '14' = @('14101') }
    }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $saved = Write-TestMap $payload
    $watch.Stop()
    $versionId = $saved.versionId
    Assert-Check ($saved.success -and $versionId) ('batch save (' + $watch.ElapsedMilliseconds + ' ms)')
    $loaded = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
    Assert-Check ($loaded.data.versionName -eq $testName -and $loaded.data.versionId -eq $versionId) 'version identity restored'
    Assert-Check ($loaded.data.selectedAreas.Count -eq 2 -and $loaded.data.areaColors.'14101' -eq 'color2' -and $loaded.data.selectedPref -eq '13') 'multi-prefecture map round trip'
    $payload.versionId = $versionId
    $payload.selectedAreas = @('13101', '13102', '14101')
    $payload.areaColors.'13102' = 'color3'
    $updated = Write-TestMap $payload
    $loaded = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
    Assert-Check ($updated.versionId -eq $versionId -and $loaded.data.selectedAreas.Count -eq 3) 'overwrite uses existing version and retains all areas'
    $invalid = $payload.Clone()
    $invalid.areaColors = @{ '13101' = 'invalid-color'; '13102' = 'color3'; '14101' = 'color2' }
    $response = Invoke-WebRequest -Uri ($BaseUrl + '/api/population/map/save') -Method Post -ContentType 'application/json' -Body ($invalid | ConvertTo-Json -Depth 6) -WebSession $PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
    Assert-Check ($response.StatusCode -eq 400) 'invalid save rejected before mutation'
    $loaded = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
    Assert-Check ($loaded.data.selectedAreas.Count -eq 3 -and $loaded.data.areaColors.'13101' -eq 'color1') 'failed validation preserves saved data'
    $allCodes = @((Read-MapApi '/api/population/estat?level=muni&prefCode=13').records.code) + @((Read-MapApi '/api/population/estat?level=muni&prefCode=14').records.code)
    $payload.selectedAreas = $allCodes
    $payload.areaColors = @{}
    foreach ($code in $allCodes) { $payload.areaColors[$code] = 'color2' }
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $bulk = Write-TestMap $payload
    $watch.Stop()
    $loaded = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
    Assert-Check ($bulk.success -and $loaded.data.selectedAreas.Count -eq $allCodes.Count) ('large batch round trip: ' + $allCodes.Count + ' areas (' + $watch.ElapsedMilliseconds + ' ms)')
    # PostgreSQL rejects NUL inside jsonb during the color insert, after the deletes.
    # This operates only on our temporary version and verifies real transaction rollback.
    $sqlFailure = $payload.Clone()
    $sqlFailure.colorNames = @{ color1 = ('invalid' + [char]0 + 'jsonb') }
    $response = Invoke-WebRequest -Uri ($BaseUrl + '/api/population/map/save') -Method Post -ContentType 'application/json' -Body ($sqlFailure | ConvertTo-Json -Depth 6) -WebSession $PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
    Assert-Check ($response.StatusCode -eq 500) 'database error injected into temporary version'
    $loaded = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
    Assert-Check ($loaded.data.selectedAreas.Count -eq $allCodes.Count -and $loaded.data.areaColors.'13101' -eq 'color2' -and $loaded.data.colorNames.color1 -eq 'test red') 'transaction rolls back deletes and restores previous data'
    $response = Invoke-WebRequest -Uri ($BaseUrl + '/api/population/map/save') -Method Post -Headers @{ Origin = 'https://invalid.example' } -ContentType 'application/json' -Body ($payload | ConvertTo-Json -Depth 6) -WebSession $PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
    # Netlify dev can translate a denied upstream route to its fallback 404.
    Assert-Check ($response.StatusCode -in @(403, 404)) 'cross-origin save denied'
} finally {
    $null = $PopulationTestSession.Headers.Remove('Origin')
    # Delete only the uniquely named version created by this test, never a user version.
    if ($versionId) {
        $check = Read-MapApi ('/api/population/map/load?versionId=' + $versionId)
        if ($check.data.versionName -ne $testName) { throw 'Test cleanup refused: version name changed' }
        $deleted = Invoke-WebRequest -Uri ($BaseUrl + '/api/population/map/versions/delete?versionId=' + $versionId) -Method Delete -WebSession $PopulationTestSession -UseBasicParsing -SkipHttpErrorCheck
        Assert-Check ($deleted.StatusCode -eq 200) 'temporary test version removed'
    }
}
$after = Read-MapApi '/api/population/map/versions/list'
Assert-Check ($after.versions.Count -eq $before.versions.Count) 'original saved-version count unchanged'
foreach ($path in @('/api/population/estat?level=pref', '/api/population/estat?level=muni&prefCode=13', '/api/population/estat?level=area')) {
    $watch = [Diagnostics.Stopwatch]::StartNew()
    $data = Read-MapApi $path
    $watch.Stop()
    Assert-Check ($data.records.Count -gt 0) ('statistics loaded: ' + $path + ' (' + $watch.ElapsedMilliseconds + ' ms)')
}
