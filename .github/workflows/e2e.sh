#!/bin/sh

# This script checks if the prisma e2e test workflow passes

check() {
	str=$(curl -s "https://github.com/prisma/prisma2-e2e-tests/workflows/test/badge.svg")

	case "$str" in
		*"no status"*)
			echo "no status, waiting..."
			sleep 10
			check
			return
			;;
	esac

	case "$str" in
		*passing*)
			echo "success"
			exit 0
			;;
	esac

	echo "fail"
	exit 1
}

check
