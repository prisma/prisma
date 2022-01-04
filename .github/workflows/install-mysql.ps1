Invoke-Expression (New-Object System.Net.WebClient).DownloadString('https://get.scoop.sh')

scoop install mysql

$DefaultsFile = Join-Path (Resolve-Path ~).Path "scoop\apps\mysql\current\my.ini"
mysqld --install MySQL --defaults-file="$DefaultsFile"
sc start MySQL
