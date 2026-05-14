# 019 - title precedence: JSON wins, H1 becomes dead text

A record has both `title: "From JSON"` and a markdown `# From H1`. JSON wins per §2.3,
and engines SHOULD emit `mosaic.title.dead-h1` warning. Resolved title is "From JSON".
