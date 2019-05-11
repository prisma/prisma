#!/usr/bin/env bash
OS=${OS:-darwin}
CHANNEL=${CHANNEL:-alpha}

echo "Downloading prisma for $OS and release channel $CHANNEL"
rm -f prisma
curl "https://s3-eu-west-1.amazonaws.com/prisma-native/$CHANNEL/latest/$OS/prisma" -o prisma
chmod +x prisma

echo "Finishing setup"
cp utils/$OS/schema-inferrer-bin .

echo "Done"