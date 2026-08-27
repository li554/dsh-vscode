#!/bin/bash
cd "D:/PycharmProjects/Work/dsh-vscode" || exit 1
npm install --no-audit --no-fund --loglevel=error > .smoke/npm-install.log 2>&1
echo "NPM-EXIT=$?" >> .smoke/npm-install.log
