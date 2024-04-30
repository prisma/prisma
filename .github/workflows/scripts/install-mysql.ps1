iwr -useb 'https://get.scoop.sh' -outfile 'scoopinstaller.ps1'
.\scoopinstaller.ps1 -RunAsAdmin

scoop install mysql@8.3

$DefaultsFile = Join-Path (Resolve-Path ~).Path "scoop\apps\mysql\current\my.ini"
mysqld --install MySQL --defaults-file="$DefaultsFile"
sc start MySQL
