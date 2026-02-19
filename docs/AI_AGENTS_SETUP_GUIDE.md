# AI Agents Setup Guide

A comprehensive guide for creating and configuring AI agents in the SunnyAI platform.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [GitHub AI Agent](#1-github-ai-agent)
3. [Jira AI Agent](#2-jira-ai-agent)
4. [AWS AI Agent](#3-aws-ai-agent)
5. [RDS AI Agent](#4-rds-ai-agent)
6. [Quick Reference](#quick-reference-agent-creation-checklist)
7. [Testing Your Agents](#testing-your-agents)

---

## Prerequisites

Before creating any agent, ensure you have:

1. **Provider Configured** - At least one AI provider (e.g., Groq, OpenAI, Azure, Anthropic, AWS Bedrock)
2. **Secrets Added** - Required API keys/tokens at the Organization level
3. **MCP Servers Configured** - Model Context Protocol servers started and tools discovered

### Accessing the Platform

| Service | URL |
|---------|-----|
| Frontend UI | http://localhost:3000 |
| Backend API | http://localhost:8000/api |
| API Documentation | http://localhost:8000/docs |

---

## 1. GitHub AI Agent

Manage GitHub repositories, issues, pull requests, and code.

### Step 1: Create GitHub Personal Access Token

1. Navigate to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Select the following scopes:
   - `repo` - Full control of private repositories
   - `read:org` - Read organization membership
   - `read:user` - Read user profile data
4. Click **Generate token**
5. Copy the token (starts with `ghp_`)

> **Important:** Store this token securely. You won't be able to see it again.

### Step 2: Add Secret to Platform

1. Navigate to **Secrets & Variables** in the sidebar
2. Click **Add Secret**
3. Configure:

| Field | Value |
|-------|-------|
| Name | `GITHUB_TOKEN` |
| Value | `ghp_xxxxxxxxxxxxxxxxxxxx` |
| Scope | Organization |

4. Click **Save**

### Step 3: Configure MCP Server

The `github` MCP server is built-in and should already exist.

1. Navigate to **MCP Servers**
2. Find the `github` server
3. Click **Start** to activate it
4. Click **Discover** to fetch available tools

#### Available GitHub Tools

| Tool Name | Description |
|-----------|-------------|
| `github__list_repos` | List repositories for a user or organization |
| `github__get_repo` | Get detailed repository information |
| `github__list_issues` | List issues in a repository |
| `github__get_issue` | Get a specific issue by number |
| `github__create_issue` | Create a new issue |
| `github__list_prs` | List pull requests |
| `github__get_pr` | Get pull request details |
| `github__list_branches` | List repository branches |
| `github__get_file_contents` | Read file contents from a repository |
| `github__search_code` | Search for code across repositories |

### Step 4: Create the Agent

1. Navigate to **Agents** → Click **Create Agent**
2. Fill in the configuration:

| Field | Value |
|-------|-------|
| **Name** | GitHub Assistant |
| **Description** | Manages GitHub repositories, issues, and pull requests |
| **Provider** | Select your configured provider |
| **Model** | Select a model (e.g., `llama-3.3-70b-versatile`, `gpt-4o`) |
| **Tools** | (None needed if using MCP) |
| **MCP Servers** | Select `github` |
| **Temperature** | 0.3 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |

3. Add the following **Runbook**:

```markdown
You are a GitHub Assistant that helps manage repositories, issues, and pull requests.

## Capabilities
- List and search repositories
- Create, read, and manage issues
- Review pull requests and their details
- Read file contents from repositories
- List branches and commits

## Guidelines
1. When asked about repositories, first list them to understand what's available
2. For issues, provide clear summaries including status, assignees, and labels
3. When creating issues, ask for title and description if not provided
4. Format code snippets and file contents with proper markdown
5. Always confirm destructive actions before proceeding

## Response Format
- Use markdown for formatting
- Include links to GitHub resources when relevant
- Summarize long lists with key highlights
- Use code blocks for file contents and code snippets
```

4. Click **Create Agent**

### Example Queries

```
"List all open issues in the myorg/myrepo repository"
"Show me the README file from owner/repo"
"Create an issue titled 'Bug: Login fails' in myorg/myrepo"
"What are the most recent pull requests?"
"List all branches in the repository"
```

---

## 2. Jira AI Agent

Manage Jira projects, issues, sprints, and workflows.

### Step 1: Create Jira API Token

1. Navigate to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Enter a label (e.g., "SunnyAI Agent")
4. Click **Create**
5. Copy the token immediately

> **Note:** The token is only shown once. Store it securely.

### Step 2: Add Secrets to Platform

Navigate to **Secrets & Variables** and add three secrets:

| Name | Value | Example |
|------|-------|---------|
| `JIRA_URL` | Your Jira instance URL | `https://yourcompany.atlassian.net` |
| `JIRA_USERNAME` | Your Atlassian email | `you@company.com` |
| `JIRA_API_TOKEN` | The API token you created | `ATATT3xFfGF0bsrqZw...` |

### Step 3: Configure MCP Server

1. Navigate to **MCP Servers** → Click **Add Server**
2. Configure:

| Field | Value |
|-------|-------|
| **Name** | `jira` |
| **Command** | `uvx` |
| **Args** | `["--python=3.12", "mcp-atlassian"]` |
| **Environment Variables** | `{"JIRA_URL": "", "JIRA_USERNAME": "", "JIRA_API_TOKEN": ""}` |

3. Click **Create**
4. Click **Start** to activate the server
5. Click **Discover** to fetch available tools (39 tools)

#### Available Jira Tools

| Tool Name | Description |
|-----------|-------------|
| `jira_get_issue` | Get issue details by key (e.g., PROJ-123) |
| `jira_search` | Search issues using JQL |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update issue fields |
| `jira_delete_issue` | Delete an issue |
| `jira_add_comment` | Add comment to an issue |
| `jira_transition_issue` | Change issue status |
| `jira_assign_issue` | Assign issue to a user |
| `jira_get_transitions` | Get available status transitions |
| `jira_get_projects` | List all projects |
| `jira_get_project` | Get project details |
| `jira_get_boards` | List Jira boards |
| `jira_get_sprints_from_board` | Get sprints for a board |
| `jira_get_sprint_issues` | Get issues in a sprint |
| `jira_add_worklog` | Log time on an issue |
| `jira_get_worklogs` | Get worklogs for an issue |

### Step 4: Create the Agent

| Field | Value |
|-------|-------|
| **Name** | Jira Assistant |
| **Description** | Manages Jira issues, sprints, and project workflows |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **MCP Servers** | Select `jira` |
| **Temperature** | 0.3 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 15 |

**Runbook:**

```markdown
You are a Jira Assistant that helps manage projects, issues, and sprints.

## Capabilities
- Search and retrieve issues using JQL
- Create new issues with proper fields
- Update issue status, assignee, and fields
- Add comments and manage transitions
- View sprint and board information
- List projects and their details

## Guidelines
1. When searching issues, use JQL for precise queries
2. Always confirm issue details before creation
3. For status changes, first get available transitions
4. Include issue keys (e.g., PROJ-123) in responses
5. Summarize sprint progress with counts and percentages

## Common JQL Examples
- Open bugs: `project = PROJ AND issuetype = Bug AND status != Done`
- My issues: `assignee = currentUser() AND status != Done`
- Sprint issues: `sprint in openSprints()`
- Recent updates: `updated >= -7d ORDER BY updated DESC`
- High priority: `priority in (Highest, High) AND status != Done`
- Unassigned: `assignee is EMPTY AND status != Done`

## Response Format
- Always include issue keys as references
- Use tables for listing multiple issues
- Show status with appropriate indicators
- Include assignee and priority information
- Format dates in a readable way
```

### Example Queries

```
"Show me all open bugs in the PROJ project"
"Create a new task: Implement user authentication"
"What issues are in the current sprint?"
"Transition PROJ-123 to In Progress"
"Add a comment to PROJ-456: 'Fixed in latest commit'"
"Who is assigned to the most issues?"
```

---

## 3. AWS AI Agent

Monitor and manage AWS resources including EC2, S3, Lambda, and more.

### Step 1: Create AWS IAM Credentials

1. Navigate to AWS Console → **IAM** → **Users**
2. Create a new user or select an existing one
3. Attach appropriate policies based on needed services:

| Policy | Access |
|--------|--------|
| `AmazonEC2ReadOnlyAccess` | EC2 instances, VPCs, Security Groups |
| `AmazonS3ReadOnlyAccess` | S3 buckets and objects |
| `CloudWatchReadOnlyAccess` | Metrics and alarms |
| `AmazonRDSReadOnlyAccess` | RDS databases |
| `AWSLambda_ReadOnlyAccess` | Lambda functions |

4. Go to **Security credentials** → **Create access key**
5. Select **Application running outside AWS**
6. Download or copy the credentials

### Step 2: Add Secrets to Platform

| Name | Value |
|------|-------|
| `AWS_ACCESS_KEY_ID` | Your access key ID (e.g., `AKIAIOSFODNN7EXAMPLE`) |
| `AWS_SECRET_ACCESS_KEY` | Your secret access key |
| `AWS_REGION` | Default region (e.g., `us-east-1`) |

### Step 3: Configure MCP Server (Option A)

If an AWS MCP server package is available:

1. Navigate to **MCP Servers** → **Add Server**
2. Configure:

| Field | Value |
|-------|-------|
| **Name** | `aws` |
| **Command** | `uvx` |
| **Args** | `["mcp-server-aws"]` |
| **Environment Variables** | `{"AWS_ACCESS_KEY_ID": "", "AWS_SECRET_ACCESS_KEY": "", "AWS_REGION": ""}` |

### Step 3: Create Custom Tools (Option B)

If no MCP server is available, create custom tools:

#### Tool 1: List EC2 Instances

Navigate to **Tools** → **Add Tool**

| Field | Value |
|-------|-------|
| **Name** | `aws_list_ec2` |
| **Description** | List EC2 instances with their status |
| **Parameters** | `{"region": {"type": "string", "description": "AWS region"}}` |

**Code:**
```python
import boto3
import json
import os

def run(region=None):
    region = region or os.environ.get('AWS_REGION', 'us-east-1')
    ec2 = boto3.client(
        'ec2',
        region_name=region,
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )
    response = ec2.describe_instances()

    instances = []
    for reservation in response['Reservations']:
        for instance in reservation['Instances']:
            name = next(
                (tag['Value'] for tag in instance.get('Tags', []) if tag['Key'] == 'Name'),
                'N/A'
            )
            instances.append({
                'InstanceId': instance['InstanceId'],
                'Name': name,
                'State': instance['State']['Name'],
                'Type': instance['InstanceType'],
                'PrivateIP': instance.get('PrivateIpAddress', 'N/A'),
                'PublicIP': instance.get('PublicIpAddress', 'N/A'),
                'LaunchTime': instance['LaunchTime'].isoformat()
            })

    return json.dumps(instances, indent=2)
```

#### Tool 2: List S3 Buckets

| Field | Value |
|-------|-------|
| **Name** | `aws_list_s3` |
| **Description** | List S3 buckets |

**Code:**
```python
import boto3
import json
import os

def run():
    s3 = boto3.client(
        's3',
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )
    response = s3.list_buckets()

    buckets = [{
        'Name': b['Name'],
        'Created': b['CreationDate'].isoformat()
    } for b in response['Buckets']]

    return json.dumps(buckets, indent=2)
```

#### Tool 3: Get CloudWatch Metrics

| Field | Value |
|-------|-------|
| **Name** | `aws_cloudwatch_metrics` |
| **Description** | Get CloudWatch metrics for a resource |

**Code:**
```python
import boto3
import json
import os
from datetime import datetime, timedelta

def run(namespace: str, metric_name: str, dimension_name: str, dimension_value: str, hours: int = 1):
    cloudwatch = boto3.client(
        'cloudwatch',
        region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )

    response = cloudwatch.get_metric_statistics(
        Namespace=namespace,
        MetricName=metric_name,
        Dimensions=[{'Name': dimension_name, 'Value': dimension_value}],
        StartTime=datetime.utcnow() - timedelta(hours=hours),
        EndTime=datetime.utcnow(),
        Period=300,
        Statistics=['Average', 'Maximum', 'Minimum']
    )

    datapoints = sorted(response['Datapoints'], key=lambda x: x['Timestamp'])

    return json.dumps({
        'namespace': namespace,
        'metric': metric_name,
        'resource': dimension_value,
        'datapoints': [{
            'timestamp': dp['Timestamp'].isoformat(),
            'average': round(dp.get('Average', 0), 2),
            'maximum': round(dp.get('Maximum', 0), 2),
            'minimum': round(dp.get('Minimum', 0), 2)
        } for dp in datapoints]
    }, indent=2)
```

### Step 4: Create the Agent

| Field | Value |
|-------|-------|
| **Name** | AWS Assistant |
| **Description** | Monitors and manages AWS resources |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **Tools** | Select `aws_list_ec2`, `aws_list_s3`, `aws_cloudwatch_metrics` |
| **MCP Servers** | Select `aws` (if using MCP) |
| **Temperature** | 0.2 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |

**Runbook:**

```markdown
You are an AWS Assistant that helps monitor and manage AWS resources.

## Capabilities
- List and describe EC2 instances
- View S3 buckets and objects
- Check CloudWatch metrics and alarms
- Monitor resource utilization
- View Lambda functions and configurations

## Guidelines
1. Always specify the AWS region when relevant
2. Format resource IDs clearly (e.g., i-1234567890abcdef0)
3. Show costs and billing information when available
4. Warn about any resources that might incur charges
5. Never perform destructive actions without explicit confirmation

## Security Best Practices
- Never expose access keys or secrets in responses
- Recommend least-privilege IAM policies
- Flag security group misconfigurations
- Alert on publicly accessible resources
- Identify unused or idle resources

## Common CloudWatch Namespaces
- AWS/EC2: EC2 instance metrics
- AWS/RDS: RDS database metrics
- AWS/Lambda: Lambda function metrics
- AWS/S3: S3 bucket metrics
- AWS/ELB: Load balancer metrics

## Response Format
- Use tables for listing resources
- Include resource tags and metadata
- Show status with clear indicators (✓ running, ✗ stopped)
- Group resources by region or service
- Include timestamps for all time-sensitive data
```

### Example Queries

```
"List all running EC2 instances in us-east-1"
"Show me all S3 buckets"
"What's the CPU utilization for instance i-1234567890abcdef0?"
"Are there any stopped instances that could be terminated?"
"Show CloudWatch metrics for the production database"
```

---

## 4. RDS AI Agent

Monitor RDS databases and execute read-only queries.

### Step 1: Create IAM and Database Credentials

#### IAM Credentials
Create an IAM user with the following policies:
- `AmazonRDSReadOnlyAccess`
- `AmazonRDSPerformanceInsightsReadOnly`
- `CloudWatchReadOnlyAccess`

#### Database Credentials
You'll need connection details for your RDS instance:
- Endpoint (hostname)
- Port
- Database name
- Username and password

### Step 2: Add Secrets to Platform

| Name | Value | Example |
|------|-------|---------|
| `AWS_ACCESS_KEY_ID` | IAM access key | `AKIAIOSFODNN7EXAMPLE` |
| `AWS_SECRET_ACCESS_KEY` | IAM secret key | `wJalrXUtnFEMI/K7MDENG/...` |
| `AWS_REGION` | AWS region | `us-east-1` |
| `RDS_HOST` | Database endpoint | `mydb.xxxxx.us-east-1.rds.amazonaws.com` |
| `RDS_PORT` | Database port | `5432` (PostgreSQL) or `3306` (MySQL) |
| `RDS_DATABASE` | Database name | `production` |
| `RDS_USERNAME` | Database user | `readonly_user` |
| `RDS_PASSWORD` | Database password | `your-secure-password` |

### Step 3: Create Custom RDS Tools

#### Tool 1: List RDS Instances

| Field | Value |
|-------|-------|
| **Name** | `rds_list_instances` |
| **Description** | List RDS database instances with status and metrics |

**Code:**
```python
import boto3
import json
import os

def run(region=None):
    region = region or os.environ.get('AWS_REGION', 'us-east-1')
    rds = boto3.client(
        'rds',
        region_name=region,
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )

    response = rds.describe_db_instances()

    instances = []
    for db in response['DBInstances']:
        instances.append({
            'DBInstanceId': db['DBInstanceIdentifier'],
            'Engine': f"{db['Engine']} {db.get('EngineVersion', '')}",
            'Status': db['DBInstanceStatus'],
            'Class': db['DBInstanceClass'],
            'Storage': f"{db['AllocatedStorage']} GB",
            'Endpoint': db.get('Endpoint', {}).get('Address', 'N/A'),
            'Port': db.get('Endpoint', {}).get('Port', 'N/A'),
            'MultiAZ': db.get('MultiAZ', False),
            'StorageType': db.get('StorageType', 'N/A')
        })

    return json.dumps(instances, indent=2)
```

#### Tool 2: Execute PostgreSQL Query

| Field | Value |
|-------|-------|
| **Name** | `rds_query_postgres` |
| **Description** | Execute a read-only SQL query on PostgreSQL RDS |
| **Parameters** | `{"query": {"type": "string", "description": "SQL SELECT query"}}` |

**Code:**
```python
import psycopg2
import json
import os

def run(query: str):
    # Security: Only allow SELECT queries
    query_upper = query.strip().upper()
    if not query_upper.startswith('SELECT'):
        return json.dumps({
            "error": "Only SELECT queries are allowed for safety reasons"
        })

    # Block dangerous keywords
    dangerous_keywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT']
    for keyword in dangerous_keywords:
        if keyword in query_upper:
            return json.dumps({
                "error": f"Query contains forbidden keyword: {keyword}"
            })

    try:
        conn = psycopg2.connect(
            host=os.environ.get('RDS_HOST'),
            port=int(os.environ.get('RDS_PORT', 5432)),
            database=os.environ.get('RDS_DATABASE'),
            user=os.environ.get('RDS_USERNAME'),
            password=os.environ.get('RDS_PASSWORD'),
            connect_timeout=10
        )

        cursor = conn.cursor()
        cursor.execute(query)

        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchmany(100)  # Limit to 100 rows
        total_count = cursor.rowcount

        results = [dict(zip(columns, row)) for row in rows]

        return json.dumps({
            "columns": columns,
            "rows": results,
            "returned": len(results),
            "total": total_count
        }, default=str, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})
    finally:
        if 'conn' in locals():
            conn.close()
```

#### Tool 3: Execute MySQL Query

| Field | Value |
|-------|-------|
| **Name** | `rds_query_mysql` |
| **Description** | Execute a read-only SQL query on MySQL RDS |

**Code:**
```python
import pymysql
import json
import os

def run(query: str):
    # Security: Only allow SELECT queries
    query_upper = query.strip().upper()
    if not query_upper.startswith('SELECT'):
        return json.dumps({
            "error": "Only SELECT queries are allowed for safety reasons"
        })

    try:
        conn = pymysql.connect(
            host=os.environ.get('RDS_HOST'),
            port=int(os.environ.get('RDS_PORT', 3306)),
            database=os.environ.get('RDS_DATABASE'),
            user=os.environ.get('RDS_USERNAME'),
            password=os.environ.get('RDS_PASSWORD'),
            connect_timeout=10
        )

        cursor = conn.cursor()
        cursor.execute(query)

        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchmany(100)

        results = [dict(zip(columns, row)) for row in rows]

        return json.dumps({
            "columns": columns,
            "rows": results,
            "count": len(results)
        }, default=str, indent=2)

    except Exception as e:
        return json.dumps({"error": str(e)})
    finally:
        if 'conn' in locals():
            conn.close()
```

#### Tool 4: RDS Performance Metrics

| Field | Value |
|-------|-------|
| **Name** | `rds_performance_metrics` |
| **Description** | Get RDS CloudWatch performance metrics |

**Code:**
```python
import boto3
import json
import os
from datetime import datetime, timedelta

def run(db_instance_id: str, metric_name: str = "CPUUtilization", hours: int = 1):
    cloudwatch = boto3.client(
        'cloudwatch',
        region_name=os.environ.get('AWS_REGION', 'us-east-1'),
        aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
        aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY')
    )

    response = cloudwatch.get_metric_statistics(
        Namespace='AWS/RDS',
        MetricName=metric_name,
        Dimensions=[{
            'Name': 'DBInstanceIdentifier',
            'Value': db_instance_id
        }],
        StartTime=datetime.utcnow() - timedelta(hours=hours),
        EndTime=datetime.utcnow(),
        Period=300,  # 5-minute intervals
        Statistics=['Average', 'Maximum', 'Minimum']
    )

    datapoints = sorted(response['Datapoints'], key=lambda x: x['Timestamp'])

    # Calculate summary
    if datapoints:
        avg_values = [dp['Average'] for dp in datapoints]
        summary = {
            'current': round(avg_values[-1], 2) if avg_values else 0,
            'average': round(sum(avg_values) / len(avg_values), 2),
            'maximum': round(max(dp['Maximum'] for dp in datapoints), 2),
            'minimum': round(min(dp['Minimum'] for dp in datapoints), 2)
        }
    else:
        summary = {}

    return json.dumps({
        'instance': db_instance_id,
        'metric': metric_name,
        'period_hours': hours,
        'summary': summary,
        'datapoints': [{
            'timestamp': dp['Timestamp'].isoformat(),
            'average': round(dp['Average'], 2),
            'maximum': round(dp['Maximum'], 2)
        } for dp in datapoints[-12:]]  # Last 12 datapoints
    }, indent=2)
```

### Step 4: Create the Agent

| Field | Value |
|-------|-------|
| **Name** | RDS Database Assistant |
| **Description** | Monitors RDS databases and executes read-only queries |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **Tools** | Select all RDS tools created above |
| **Temperature** | 0.2 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |

**Runbook:**

```markdown
You are an RDS Database Assistant that helps monitor and query AWS RDS databases.

## Capabilities
- List RDS database instances and their status
- Execute read-only SQL queries (SELECT only)
- Monitor database performance metrics
- Check storage utilization and connections
- Analyze query results and provide insights

## Safety Rules - CRITICAL
1. ONLY execute SELECT queries - never modify data
2. Never execute DROP, DELETE, UPDATE, INSERT, ALTER, or TRUNCATE
3. Do not expose connection credentials in responses
4. Limit query results to avoid overwhelming responses
5. Warn about potentially expensive queries (full table scans)

## Guidelines
1. Always check database status before attempting queries
2. Format large result sets as summary tables
3. Explain query results in plain language
4. Monitor CPU, memory, and storage proactively
5. Suggest query optimizations when appropriate

## Common Performance Metrics
| Metric | Description | Warning Threshold |
|--------|-------------|-------------------|
| CPUUtilization | Database CPU usage | > 80% |
| FreeableMemory | Available RAM | < 1 GB |
| FreeStorageSpace | Available storage | < 10% |
| DatabaseConnections | Active connections | Near max |
| ReadIOPS | Read operations/sec | Sustained high |
| WriteIOPS | Write operations/sec | Sustained high |
| ReadLatency | Read latency (ms) | > 20ms |
| WriteLatency | Write latency (ms) | > 20ms |

## SQL Query Tips
- Always use LIMIT to restrict result sets
- Avoid SELECT * on large tables
- Use WHERE clauses to filter data
- Consider using EXPLAIN to analyze query performance

## Response Format
- Format query results as markdown tables
- Show metrics with trends (↑ increasing, ↓ decreasing, → stable)
- Include timestamps for all data
- Summarize large result sets with key statistics
- Highlight anomalies or concerning values
```

### Example Queries

```
"List all RDS database instances"
"Show me the CPU utilization for mydb-production over the last hour"
"Execute: SELECT COUNT(*) FROM users WHERE created_at > '2024-01-01'"
"What's the current storage usage for all databases?"
"Are there any performance issues with the production database?"
"Show the top 10 largest tables in the database"
```

---

## Quick Reference: Agent Creation Checklist

Use this checklist when creating any new agent:

### Prerequisites
- [ ] AI Provider configured with valid API key
- [ ] Required secrets added at Organization level
- [ ] MCP Server created and started (if applicable)
- [ ] Tools discovered or custom tools created

### Agent Configuration
- [ ] Descriptive name and description
- [ ] Appropriate model selected
- [ ] Tools or MCP servers attached
- [ ] Temperature set (lower for factual tasks, higher for creative)
- [ ] Max tokens configured
- [ ] Max iterations set (higher for complex multi-step tasks)

### Runbook
- [ ] Clear capability description
- [ ] Step-by-step guidelines
- [ ] Safety rules and constraints
- [ ] Response format guidelines
- [ ] Example interactions

### Testing
- [ ] Basic functionality test
- [ ] Error handling test
- [ ] Edge case testing
- [ ] Performance verification

---

## Testing Your Agents

### Via UI (Playground)

1. Navigate to **Playground** in the sidebar
2. Click the **Agent** tab
3. Select your agent from the dropdown
4. Enter a test query
5. Click **Send** or press Enter
6. Review the response and any tool calls made

### Via API (cURL)

```bash
# Non-streaming request
curl -X POST "http://localhost:8000/api/agents/{AGENT_ID}/query" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Your test query here",
    "stream": false
  }'
```

### Via API (Postman)

1. Create a new POST request
2. URL: `http://localhost:8000/api/agents/{AGENT_ID}/query`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "query": "Your test query here",
  "stream": false
}
```

### Example Test Queries by Agent

| Agent | Test Query |
|-------|------------|
| **GitHub** | "List the 5 most recent issues in owner/repo" |
| **Jira** | "Show me all open bugs assigned to me" |
| **AWS** | "List all running EC2 instances in us-east-1" |
| **RDS** | "Show database instances and their CPU utilization" |

### Expected Response Structure

```json
{
  "content": "The final response text from the agent",
  "steps": [
    {
      "type": "thinking",
      "iteration": 1
    },
    {
      "type": "tool_call",
      "tool": "tool_name",
      "arguments": {"param": "value"},
      "iteration": 1
    },
    {
      "type": "tool_result",
      "tool": "tool_name",
      "result": "...",
      "iteration": 1
    },
    {
      "type": "final_answer",
      "content": "...",
      "iteration": 2
    }
  ],
  "iterations": 2,
  "usage": {
    "input_tokens": 150,
    "output_tokens": 200,
    "total_tokens": 350
  }
}
```

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Agent not found" | Invalid agent ID | Verify agent ID in the Agents page |
| "Provider not configured" | Missing provider | Add a provider with valid API key |
| "Missing required configuration" | Secrets not set | Add required secrets at Org level |
| "MCP server timeout" | Server not responding | Restart the MCP server |
| "Tool execution failed" | Invalid parameters | Check tool parameter requirements |

### Debugging Tips

1. **Check MCP Server Status**: Ensure the server is "running"
2. **Verify Secrets**: Test credentials manually if possible
3. **Review Agent Logs**: Check Observability page for detailed logs
4. **Test Tools Individually**: Use the Tools page to test tool execution
5. **Simplify Queries**: Start with basic queries before complex ones

---

## Best Practices

1. **Use Specific Runbooks**: Detailed instructions lead to better agent behavior
2. **Set Appropriate Temperature**: Lower (0.1-0.3) for factual tasks, higher (0.7-1.0) for creative
3. **Limit Max Iterations**: Prevent infinite loops with reasonable limits
4. **Test Incrementally**: Verify each component before combining
5. **Monitor Usage**: Use Observability to track costs and performance
6. **Secure Credentials**: Always use Secrets, never hardcode in runbooks
7. **Handle Errors Gracefully**: Include error handling guidance in runbooks

---

## Additional Resources

- **API Documentation**: http://localhost:8000/docs
- **MCP Protocol**: https://modelcontextprotocol.io
- **LiteLLM Providers**: https://docs.litellm.ai/docs/providers

---

*Last updated: February 2025*
