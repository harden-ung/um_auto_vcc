git update-index --assume-unchanged settings.json
git update-index --assume-unchanged proxies.txt
git update-index --assume-unchanged data.txt
git update-index --assume-unchanged reports/*

del -f "node_modules/"
npm install
cmd /k