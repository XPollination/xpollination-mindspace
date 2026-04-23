#!/bin/bash
#===============================================================================
# claude-updateAll.sh — Run `claude update` for every Claude-capable user
# across all xp0 hosts (hetzner-cx22 dev, office-xp0) and report which
# users received a new version.
#
# Usage:
#   claude-updateAll              Update all users on all hosts
#   claude-updateAll --dry-run    Print version per user, do not update
#===============================================================================
set -euo pipefail

DRY=0
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY=1
fi

OFFICE_HOST=178.104.208.66
OFFICE_USER=xpo-agent
OFFICE_KEY=/home/developer/.ssh/id_ed25519_xp0_newserver

# The SSH key is under /home/developer/.ssh/ and only developer can read it.
# If invoked by any other user (e.g. thomas via sudoers), wrap the ssh call in
# `sudo -u developer`. Same pattern as claude-session.sh / claude-maria.sh.
if [[ "$(id -un)" == "developer" ]]; then
    SSH_WRAP=(ssh)
else
    SSH_WRAP=(sudo -u developer env "TERM=${TERM:-xterm-256color}" ssh)
fi

# Hosts and the users on each host that run Claude Code.
DEV_USERS=(developer)
OFFICE_USERS=(xpo-agent maria thomas)

_local_run() {
    local user="$1"; shift
    if [[ "$(id -un)" == "$user" ]]; then
        bash -lc "$*" 2>&1
    else
        sudo -iu "$user" bash -lc "$*" 2>&1
    fi
}

_ver() {
    local user="$1" host="$2"
    if [[ "$host" == "local" ]]; then
        _local_run "$user" 'claude --version 2>/dev/null | head -1' || echo "(claude not installed)"
    else
        "${SSH_WRAP[@]}" -i "$OFFICE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
            "${OFFICE_USER}@${OFFICE_HOST}" \
            "sudo -iu $user bash -lc 'claude --version 2>/dev/null | head -1' || echo '(claude not installed)'"
    fi
}

_update() {
    local user="$1" host="$2"
    if [[ "$host" == "local" ]]; then
        _local_run "$user" 'claude update 2>&1 | tail -10'
    else
        "${SSH_WRAP[@]}" -i "$OFFICE_KEY" -o StrictHostKeyChecking=accept-new -o IdentitiesOnly=yes \
            "${OFFICE_USER}@${OFFICE_HOST}" \
            "sudo -iu $user bash -lc 'claude update 2>&1 | tail -10'"
    fi
}

run_host() {
    local host_label="$1"; shift
    local host_kind="$1"; shift  # "local" or "office-xp0"
    local users=("$@")
    echo "========================================"
    echo "HOST: $host_label"
    echo "========================================"
    for user in "${users[@]}"; do
        echo "-- $user --"
        local before
        before=$(_ver "$user" "$host_kind" || echo "unknown")
        echo "  before: $before"
        if [[ "$DRY" -eq 0 ]]; then
            local output
            output=$(_update "$user" "$host_kind" 2>&1) || true
            echo "  update: $output"
            local after
            after=$(_ver "$user" "$host_kind" || echo "unknown")
            echo "  after : $after"
            if [[ "$before" != "$after" ]]; then
                echo "  RESULT: updated"
            else
                echo "  RESULT: already current"
            fi
        fi
    done
}

run_host "hetzner-cx22 (local)" "local" "${DEV_USERS[@]}"
run_host "office-xp0" "office-xp0" "${OFFICE_USERS[@]}"

echo ""
echo "Done."
