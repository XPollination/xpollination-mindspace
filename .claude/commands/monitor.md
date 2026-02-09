# /monitor - Start Agent Monitor

Start the agent monitor for a specified role. The monitor polls for tasks every 30 seconds and writes work to `/tmp/agent-work-{role}.json`.

## Usage

```
/monitor <role>
```

Where `<role>` is one of: `qa`, `pdsa`, `dev`

## What it does

1. Starts `viz/agent-monitor.cjs` with the specified role
2. Logs output to `/tmp/agent-monitor-{role}.log`
3. Writes found work to `/tmp/agent-work-{role}.json`

## Implementation

Run this command:

```bash
source ~/.nvm/nvm.sh && nohup node viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

Then verify with:

```bash
sleep 2 && tail -3 /tmp/agent-monitor-$ARGUMENTS.log
```

## Check for work

After starting, check for work with:

```bash
stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
```

- Returns `0` = no work
- Returns `>0` = work found, read the file
