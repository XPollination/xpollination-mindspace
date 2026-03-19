# PDSA: Mission State Badges and Backlog Indicators

## Plan
Display mission state (draft/ready/active/complete/deprecated) as colored badges in viz. Show backlog count per mission. Integrates with mission-state-machine and backlog-status implementations.

## Do
DEV adds state badges + backlog counts to mission cards in viz index.html.

## Study
Each mission shows correct state badge color and backlog count.

## Act
Color mapping: draft=gray, ready=blue, active=green, complete=gold, deprecated=red-strikethrough. Backlog count from dna_json status='backlog' WHERE requirement_ref matches mission capabilities.
