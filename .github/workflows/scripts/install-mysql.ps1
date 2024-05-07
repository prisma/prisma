iwr -useb 'https://get.scoop.sh' -outfile 'scoopinstaller.ps1'
.\scoopinstaller.ps1 -RunAsAdmin

scoop install sudo

scoop install mysql-lts

sudo mysqld --install

sudo sc start MySQL
