robocopy "../shapez.io/src/" "./" "index.html"

robocopy "../shapez.io-Puzzle/build/" "./shapez/Puzzlemode" /S

git add -A

git commit -m "_push-Puzzlemode"

git push
