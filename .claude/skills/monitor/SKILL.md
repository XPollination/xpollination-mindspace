---
name: monitor
description: Start agent monitor for specified role (qa, pdsa, dev). Polls for tasks every 30s.
user-invocable: true
---

# Start Agent Monitor for $ARGUMENTS

Start the background monitor for role: **$ARGUMENTS**

## Steps

1. Kill any existing monitor for this role:
```bash
pkill -f "agent-monitor.cjs $ARGUMENTS" 2>/dev/null || true
```

2. Start the monitor:
```bash
source ~/.nvm/nvm.sh && nohup node viz/agent-monitor.cjs $ARGUMENTS > /tmp/agent-monitor-$ARGUMENTS.log 2>&1 &
```

3. Verify it started:
```bash
sleep 2 && tail -5 /tmp/agent-monitor-$ARGUMENTS.log
```

4. Check for work:
```bash
stat -c%s /tmp/agent-work-$ARGUMENTS.json 2>/dev/null || echo 0
```

## Output Files

- **Log:** `/tmp/agent-monitor-$ARGUMENTS.log`
- **Work:** `/tmp/agent-work-$ARGUMENTS.json` (0 bytes = no work, >0 = read it)

## Monitor Discipline

After starting, periodically check the work file:
- `0` = no work yet, check again in 30-60s
- `>0` = work found, read with `cat /tmp/agent-work-$ARGUMENTS.json`
