Output ../public/demo.gif

Set Shell "bash"
Set FontSize 16
Set Width 1000
Set Height 1050
Set Theme "Dracula"
Set Padding 20
Set TypingSpeed 60ms
Set Framerate 30

Hide
Type "unset CLAUDECODE SVELTE_VITALS_AGENT CI"
Enter
Type 'npx() { if [ "$1" = svelte-vitals ] || [ "$1" = svelte-vitals@latest ]; then shift; node ../../packages/cli/dist/bin.js "$@"; else command npx "$@"; fi; }'
Enter
Type "clear"
Enter
Show

Type "npx svelte-vitals@latest"
Enter
Sleep 4s
