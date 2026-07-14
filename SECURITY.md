# Security policy

## Supported versions

Security fixes are applied to the latest code on the default branch and, when releases exist, the latest release. Pre-release or older snapshots may not receive separate fixes.

## Reporting a vulnerability

Do not disclose a suspected vulnerability, credential, private endpoint, prompt content, or Harness output in a public issue.

Use this repository's **Security** tab to submit a private vulnerability report. Include only the minimum reproduction details needed, affected paths or versions, expected impact, and any safe mitigation you have identified. If private vulnerability reporting is not enabled, contact the repository owner privately through their GitHub profile and ask for a secure reporting channel before sending sensitive details.

For non-sensitive bugs, use the public issue tracker.

Maintainers should acknowledge a private report, assess scope, and coordinate remediation and disclosure before publishing technical details. No response or remediation deadline is guaranteed.

## Deployment responsibility

The repository defaults to local mock mode. A deployment owner is responsible for reviewing synthesized IAM permissions, configuring exact allowed origins and backend-only variables, protecting public endpoints, setting budgets and monitoring, and validating Bedrock and AgentCore Harness behavior in an isolated environment. A passing local or Harness test is not a security certification.
