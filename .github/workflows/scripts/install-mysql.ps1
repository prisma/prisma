iwr -useb 'https://get.scoop.sh' -outfile 'scoopinstaller.ps1'
.\scoopinstaller.ps1 -RunAsAdmin

scoop install mysql

$DefaultsFile = Join-Path $PSScriptRoot "my.ini"
$ScoopDefaultsFile = Join-Path (Resolve-Path ~).Path "scoop\apps\mysql\current\my.ini"

Add-Content $DefaultsFile "!include $ScoopDefaultsFile"
Add-Content $DefaultsFile "lower_case_table_names=2"

mysqld --install MySQL --defaults-file="$DefaultsFile"
sc start MySQL
