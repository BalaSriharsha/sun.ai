'use client';
import { useState } from 'react';
import { Book, Github, Server, Cloud, Database, ChevronRight, ChevronDown, Copy, Check, ExternalLink } from 'lucide-react';

const sections = [
    {
        id: 'prerequisites',
        title: 'Prerequisites',
        icon: Book,
        content: `Before creating any agent, ensure you have:

1. **Provider Configured** - At least one AI provider (e.g., Groq, OpenAI, Azure, Anthropic, AWS Bedrock)
2. **Secrets Added** - Required API keys/tokens at the Organization level
3. **MCP Servers Configured** - Model Context Protocol servers started and tools discovered`
    },
    {
        id: 'github',
        title: 'GitHub AI Agent',
        icon: Github,
        content: null,
        subsections: [
            {
                title: 'Step 1: Create GitHub Personal Access Token',
                content: `1. Navigate to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Select the following scopes:
   - \`repo\` - Full control of private repositories
   - \`read:org\` - Read organization membership
   - \`read:user\` - Read user profile data
4. Click **Generate token**
5. Copy the token (starts with \`ghp_\`)`
            },
            {
                title: 'Step 2: Add Secret to Platform',
                content: `1. Navigate to **Secrets & Variables** in the sidebar
2. Click **Add Secret**
3. Configure:

| Field | Value |
|-------|-------|
| Name | \`GITHUB_TOKEN\` |
| Value | \`ghp_xxxxxxxxxxxxxxxxxxxx\` |
| Scope | Organization |

4. Click **Save**`
            },
            {
                title: 'Step 3: Configure MCP Server',
                content: `The \`github\` MCP server is built-in and should already exist.

1. Navigate to **MCP Servers**
2. Find the \`github\` server
3. Click **Start** to activate it
4. Click **Discover** to fetch available tools

**Available GitHub Tools:**

| Tool Name | Description |
|-----------|-------------|
| \`github__list_repos\` | List repositories for a user or organization |
| \`github__get_repo\` | Get detailed repository information |
| \`github__list_issues\` | List issues in a repository |
| \`github__create_issue\` | Create a new issue |
| \`github__list_prs\` | List pull requests |
| \`github__get_pr\` | Get pull request details |
| \`github__list_branches\` | List repository branches |
| \`github__get_file_contents\` | Read file contents from a repository |`
            },
            {
                title: 'Step 4: Create the Agent',
                content: `1. Navigate to **Agents** → Click **Create Agent**
2. Fill in the configuration:

| Field | Value |
|-------|-------|
| **Name** | GitHub Assistant |
| **Description** | Manages GitHub repositories, issues, and pull requests |
| **Provider** | Select your configured provider |
| **Model** | Select a model (e.g., \`llama-3.3-70b-versatile\`) |
| **MCP Servers** | Select \`github\` |
| **Temperature** | 0.3 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |`
            },
            {
                title: 'Runbook',
                content: `\`\`\`
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
\`\`\``
            },
            {
                title: 'Example Queries',
                content: `- "List all open issues in the myorg/myrepo repository"
- "Show me the README file from owner/repo"
- "Create an issue titled 'Bug: Login fails' in myorg/myrepo"
- "What are the most recent pull requests?"
- "List all branches in the repository"`
            }
        ]
    },
    {
        id: 'jira',
        title: 'Jira AI Agent',
        icon: Server,
        content: null,
        subsections: [
            {
                title: 'Step 1: Create Jira API Token',
                content: `1. Navigate to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click **"Create API token"**
3. Enter a label (e.g., "Zeus.ai Agent")
4. Click **Create**
5. Copy the token immediately

> **Note:** The token is only shown once. Store it securely.`
            },
            {
                title: 'Step 2: Add Secrets to Platform',
                content: `Navigate to **Secrets & Variables** and add three secrets:

| Name | Value | Example |
|------|-------|---------|
| \`JIRA_URL\` | Your Jira instance URL | \`https://yourcompany.atlassian.net\` |
| \`JIRA_USERNAME\` | Your Atlassian email | \`you@company.com\` |
| \`JIRA_API_TOKEN\` | The API token you created | \`ATATT3xFfGF0bsrqZw...\` |`
            },
            {
                title: 'Step 3: Configure MCP Server',
                content: `1. Navigate to **MCP Servers** → Click **Add Server**
2. Configure:

| Field | Value |
|-------|-------|
| **Name** | \`jira\` |
| **Command** | \`uvx\` |
| **Args** | \`["--python=3.12", "mcp-atlassian"]\` |
| **Environment Variables** | \`{"JIRA_URL": "", "JIRA_USERNAME": "", "JIRA_API_TOKEN": ""}\` |

3. Click **Create**
4. Click **Start** to activate the server
5. Click **Discover** to fetch available tools (39 tools)

**Key Jira Tools:**

| Tool Name | Description |
|-----------|-------------|
| \`jira_get_issue\` | Get issue details by key (e.g., PROJ-123) |
| \`jira_search\` | Search issues using JQL |
| \`jira_create_issue\` | Create a new issue |
| \`jira_update_issue\` | Update issue fields |
| \`jira_add_comment\` | Add comment to an issue |
| \`jira_transition_issue\` | Change issue status |
| \`jira_get_projects\` | List all projects |
| \`jira_get_sprints_from_board\` | Get sprints for a board |`
            },
            {
                title: 'Step 4: Create the Agent',
                content: `| Field | Value |
|-------|-------|
| **Name** | Jira Assistant |
| **Description** | Manages Jira issues, sprints, and project workflows |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **MCP Servers** | Select \`jira\` |
| **Temperature** | 0.3 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 15 |`
            },
            {
                title: 'Runbook',
                content: `\`\`\`
You are a Jira Assistant that helps manage projects, issues, and sprints.

## Capabilities
- Search and retrieve issues using JQL
- Create new issues with proper fields
- Update issue status, assignee, and fields
- Add comments and manage transitions
- View sprint and board information

## Common JQL Examples
- Open bugs: project = PROJ AND issuetype = Bug AND status != Done
- My issues: assignee = currentUser() AND status != Done
- Sprint issues: sprint in openSprints()
- Recent updates: updated >= -7d ORDER BY updated DESC

## Guidelines
1. When searching issues, use JQL for precise queries
2. Always confirm issue details before creation
3. For status changes, first get available transitions
4. Include issue keys (e.g., PROJ-123) in responses
\`\`\``
            },
            {
                title: 'Example Queries',
                content: `- "Show me all open bugs in the PROJ project"
- "Create a new task: Implement user authentication"
- "What issues are in the current sprint?"
- "Transition PROJ-123 to In Progress"
- "Add a comment to PROJ-456: 'Fixed in latest commit'"`
            }
        ]
    },
    {
        id: 'aws',
        title: 'AWS AI Agent',
        icon: Cloud,
        content: null,
        subsections: [
            {
                title: 'Step 1: Create AWS IAM Credentials',
                content: `1. Navigate to AWS Console → **IAM** → **Users**
2. Create a new user or select an existing one
3. Attach appropriate policies:

| Policy | Access |
|--------|--------|
| \`AmazonEC2ReadOnlyAccess\` | EC2 instances, VPCs, Security Groups |
| \`AmazonS3ReadOnlyAccess\` | S3 buckets and objects |
| \`CloudWatchReadOnlyAccess\` | Metrics and alarms |
| \`AmazonRDSReadOnlyAccess\` | RDS databases |

4. Go to **Security credentials** → **Create access key**
5. Download or copy the credentials`
            },
            {
                title: 'Step 2: Add Secrets to Platform',
                content: `| Name | Value |
|------|-------|
| \`AWS_ACCESS_KEY_ID\` | Your access key ID (e.g., \`AKIAIOSFODNN7EXAMPLE\`) |
| \`AWS_SECRET_ACCESS_KEY\` | Your secret access key |
| \`AWS_REGION\` | Default region (e.g., \`us-east-1\`) |`
            },
            {
                title: 'Step 3: Create Custom Tools',
                content: `Since AWS MCP servers may not be available, create custom tools:

**Tool 1: List EC2 Instances**
- Name: \`aws_list_ec2\`
- Description: List EC2 instances with their status

**Tool 2: List S3 Buckets**
- Name: \`aws_list_s3\`
- Description: List S3 buckets

**Tool 3: CloudWatch Metrics**
- Name: \`aws_cloudwatch_metrics\`
- Description: Get CloudWatch metrics for resources

See the full documentation for complete tool code.`
            },
            {
                title: 'Step 4: Create the Agent',
                content: `| Field | Value |
|-------|-------|
| **Name** | AWS Assistant |
| **Description** | Monitors and manages AWS resources |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **Tools** | Select AWS tools created above |
| **Temperature** | 0.2 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |`
            },
            {
                title: 'Runbook',
                content: `\`\`\`
You are an AWS Assistant that helps monitor and manage AWS resources.

## Capabilities
- List and describe EC2 instances
- View S3 buckets and objects
- Check CloudWatch metrics and alarms
- Monitor resource utilization

## Security Best Practices
- Never expose access keys or secrets in responses
- Recommend least-privilege IAM policies
- Flag security group misconfigurations
- Alert on publicly accessible resources

## Guidelines
1. Always specify the AWS region when relevant
2. Format resource IDs clearly
3. Warn about resources that might incur charges
4. Never perform destructive actions without confirmation
\`\`\``
            },
            {
                title: 'Example Queries',
                content: `- "List all running EC2 instances in us-east-1"
- "Show me all S3 buckets"
- "What's the CPU utilization for instance i-1234567890abcdef0?"
- "Are there any stopped instances that could be terminated?"`
            }
        ]
    },
    {
        id: 'rds',
        title: 'RDS AI Agent',
        icon: Database,
        content: null,
        subsections: [
            {
                title: 'Step 1: Create Credentials',
                content: `**IAM Credentials:**
- \`AmazonRDSReadOnlyAccess\`
- \`AmazonRDSPerformanceInsightsReadOnly\`
- \`CloudWatchReadOnlyAccess\`

**Database Credentials:**
- Endpoint (hostname)
- Port (5432 for PostgreSQL, 3306 for MySQL)
- Database name
- Username and password`
            },
            {
                title: 'Step 2: Add Secrets to Platform',
                content: `| Name | Value | Example |
|------|-------|---------|
| \`AWS_ACCESS_KEY_ID\` | IAM access key | \`AKIAIOSFODNN7EXAMPLE\` |
| \`AWS_SECRET_ACCESS_KEY\` | IAM secret key | \`wJalrXUtnFEMI/...\` |
| \`AWS_REGION\` | AWS region | \`us-east-1\` |
| \`RDS_HOST\` | Database endpoint | \`mydb.xxxxx.rds.amazonaws.com\` |
| \`RDS_PORT\` | Database port | \`5432\` |
| \`RDS_DATABASE\` | Database name | \`production\` |
| \`RDS_USERNAME\` | Database user | \`readonly_user\` |
| \`RDS_PASSWORD\` | Database password | \`your-password\` |`
            },
            {
                title: 'Step 3: Create Custom Tools',
                content: `**Tool 1: List RDS Instances**
- Name: \`rds_list_instances\`
- Description: List RDS database instances with status

**Tool 2: Execute PostgreSQL Query**
- Name: \`rds_query_postgres\`
- Description: Execute read-only SQL queries
- **Important:** Only SELECT queries are allowed

**Tool 3: RDS Performance Metrics**
- Name: \`rds_performance_metrics\`
- Description: Get CloudWatch metrics for RDS`
            },
            {
                title: 'Step 4: Create the Agent',
                content: `| Field | Value |
|-------|-------|
| **Name** | RDS Database Assistant |
| **Description** | Monitors RDS databases and executes read-only queries |
| **Provider** | Select your provider |
| **Model** | Select a model |
| **Tools** | Select all RDS tools |
| **Temperature** | 0.2 |
| **Max Tokens** | 4096 |
| **Max Iterations** | 10 |`
            },
            {
                title: 'Runbook',
                content: `\`\`\`
You are an RDS Database Assistant.

## Safety Rules - CRITICAL
1. ONLY execute SELECT queries - never modify data
2. Never execute DROP, DELETE, UPDATE, INSERT, ALTER
3. Do not expose connection credentials
4. Limit query results to avoid overwhelming responses

## Common Performance Metrics
| Metric | Warning Threshold |
|--------|-------------------|
| CPUUtilization | > 80% |
| FreeableMemory | < 1 GB |
| FreeStorageSpace | < 10% |
| DatabaseConnections | Near max |

## Guidelines
1. Always check database status before querying
2. Use LIMIT to restrict result sets
3. Explain query results in plain language
\`\`\``
            },
            {
                title: 'Example Queries',
                content: `- "List all RDS database instances"
- "Show CPU utilization for mydb-production"
- "Execute: SELECT COUNT(*) FROM users"
- "What's the current storage usage?"
- "Show the top 10 largest tables"`
            }
        ]
    }
];

function CodeBlock({ children }) {
    const [copied, setCopied] = useState(false);
    const code = children.replace(/^```\n?/, '').replace(/\n?```$/, '');

    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{ position: 'relative', marginTop: 12 }}>
            <button
                onClick={handleCopy}
                style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
                    borderRadius: 4, padding: '4px 8px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 11,
                    color: 'var(--text-secondary)'
                }}
            >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied!' : 'Copy'}
            </button>
            <pre style={{
                background: 'var(--bg-tertiary)', padding: 16, borderRadius: 8,
                overflow: 'auto', fontSize: 13, lineHeight: 1.5,
                border: '1px solid var(--border-color)'
            }}>
                <code>{code}</code>
            </pre>
        </div>
    );
}

function MarkdownContent({ content }) {
    // Simple markdown rendering
    const lines = content.split('\n');
    const elements = [];
    let inTable = false;
    let tableRows = [];
    let inCodeBlock = false;
    let codeBlockContent = '';

    lines.forEach((line, idx) => {
        // Code blocks
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                codeBlockContent += line;
                elements.push(<CodeBlock key={idx}>{codeBlockContent}</CodeBlock>);
                codeBlockContent = '';
                inCodeBlock = false;
            } else {
                inCodeBlock = true;
                codeBlockContent = line + '\n';
            }
            return;
        }
        if (inCodeBlock) {
            codeBlockContent += line + '\n';
            return;
        }

        // Tables
        if (line.startsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            if (!line.includes('---')) {
                tableRows.push(line.split('|').filter(c => c.trim()).map(c => c.trim()));
            }
            return;
        } else if (inTable) {
            inTable = false;
            const header = tableRows[0];
            const rows = tableRows.slice(1);
            elements.push(
                <div key={idx} style={{ overflowX: 'auto', marginBottom: 16 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                {header.map((h, i) => (
                                    <th key={i} style={{
                                        textAlign: 'left', padding: '8px 12px',
                                        background: 'var(--bg-tertiary)', borderBottom: '2px solid var(--border-color)',
                                        fontWeight: 600
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((cell, ci) => (
                                        <td key={ci} style={{
                                            padding: '8px 12px', borderBottom: '1px solid var(--border-color)',
                                            fontFamily: cell.startsWith('`') ? 'var(--font-mono)' : 'inherit'
                                        }}>
                                            {cell.replace(/`/g, '')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        // Headers
        if (line.startsWith('## ')) {
            elements.push(<h3 key={idx} style={{ marginTop: 20, marginBottom: 8, fontSize: 16, fontWeight: 600 }}>{line.slice(3)}</h3>);
        } else if (line.startsWith('# ')) {
            elements.push(<h2 key={idx} style={{ marginTop: 24, marginBottom: 12, fontSize: 18, fontWeight: 700 }}>{line.slice(2)}</h2>);
        }
        // Blockquotes
        else if (line.startsWith('>')) {
            elements.push(
                <div key={idx} style={{
                    padding: '8px 12px', marginBottom: 8,
                    borderLeft: '3px solid var(--warning)', background: 'rgba(245, 158, 11, 0.1)',
                    borderRadius: '0 4px 4px 0', fontSize: 13
                }}>
                    {line.slice(1).trim()}
                </div>
            );
        }
        // List items
        else if (line.match(/^\d+\.\s/) || line.startsWith('- ')) {
            const isOrdered = line.match(/^\d+\.\s/);
            const text = isOrdered ? line.replace(/^\d+\.\s/, '') : line.slice(2);
            elements.push(
                <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 14, lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--text-tertiary)', minWidth: 16 }}>
                        {isOrdered ? line.match(/^\d+/)[0] + '.' : '•'}
                    </span>
                    <span dangerouslySetInnerHTML={{
                        __html: text
                            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                            .replace(/`(.+?)`/g, '<code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">$1</code>')
                    }} />
                </div>
            );
        }
        // Regular paragraphs
        else if (line.trim()) {
            elements.push(
                <p key={idx} style={{ marginBottom: 8, fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}
                    dangerouslySetInnerHTML={{
                        __html: line
                            .replace(/\*\*(.+?)\*\*/g, '<strong style="color: var(--text-primary)">$1</strong>')
                            .replace(/`(.+?)`/g, '<code style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 12px;">$1</code>')
                    }}
                />
            );
        }
    });

    return <div>{elements}</div>;
}

export default function DocsPage() {
    const [expandedSections, setExpandedSections] = useState({ prerequisites: true });
    const [activeSection, setActiveSection] = useState('prerequisites');

    const toggleSection = (id) => {
        setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
        setActiveSection(id);
    };

    return (
        <div className="animate-fade">
            <div className="page-header">
                <div>
                    <h1>Documentation</h1>
                    <p>AI Agents Setup Guide - Create and configure agents for GitHub, Jira, AWS, and RDS</p>
                </div>
                <a
                    href="/docs/AI_AGENTS_SETUP_GUIDE.md"
                    target="_blank"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                    <ExternalLink size={14} /> View Full Markdown
                </a>
            </div>

            <div style={{ display: 'flex', gap: 24 }}>
                {/* Sidebar Navigation */}
                <div style={{
                    width: 240, flexShrink: 0, position: 'sticky', top: 20, alignSelf: 'flex-start'
                }}>
                    <div className="card" style={{ padding: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8, padding: '0 8px' }}>
                            CONTENTS
                        </div>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => toggleSection(section.id)}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                                    padding: '8px 10px', borderRadius: 6, border: 'none',
                                    background: activeSection === section.id ? 'var(--bg-tertiary)' : 'transparent',
                                    color: activeSection === section.id ? 'var(--accent)' : 'var(--text-secondary)',
                                    cursor: 'pointer', fontSize: 13, fontWeight: 500,
                                    textAlign: 'left', transition: 'all 0.15s ease'
                                }}
                            >
                                <section.icon size={14} />
                                <span style={{ flex: 1 }}>{section.title}</span>
                                {section.subsections && (
                                    expandedSections[section.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    {sections.map(section => (
                        <div key={section.id} id={section.id} style={{ marginBottom: 32 }}>
                            <div
                                className="card"
                                style={{ padding: 0, overflow: 'hidden' }}
                            >
                                <div
                                    onClick={() => toggleSection(section.id)}
                                    style={{
                                        padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
                                        cursor: 'pointer', borderBottom: expandedSections[section.id] ? '1px solid var(--border-color)' : 'none'
                                    }}
                                >
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 8,
                                        background: 'linear-gradient(135deg, var(--accent), var(--cyan))',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: 'white'
                                    }}>
                                        <section.icon size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, fontSize: 16 }}>{section.title}</div>
                                        {section.subsections && (
                                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                                                {section.subsections.length} steps
                                            </div>
                                        )}
                                    </div>
                                    {section.subsections && (
                                        expandedSections[section.id] ? <ChevronDown size={18} /> : <ChevronRight size={18} />
                                    )}
                                </div>

                                {expandedSections[section.id] && (
                                    <div style={{ padding: 20 }}>
                                        {section.content && <MarkdownContent content={section.content} />}
                                        {section.subsections && section.subsections.map((sub, idx) => (
                                            <div key={idx} style={{
                                                marginBottom: 24,
                                                paddingBottom: 24,
                                                borderBottom: idx < section.subsections.length - 1 ? '1px solid var(--border-color)' : 'none'
                                            }}>
                                                <h4 style={{
                                                    fontSize: 14, fontWeight: 600, marginBottom: 12,
                                                    display: 'flex', alignItems: 'center', gap: 8
                                                }}>
                                                    <span style={{
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: 'var(--accent)', color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: 11, fontWeight: 700
                                                    }}>
                                                        {idx + 1}
                                                    </span>
                                                    {sub.title}
                                                </h4>
                                                <MarkdownContent content={sub.content} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {/* Quick Reference Card */}
                    <div className="card" style={{ marginTop: 32 }}>
                        <div className="card-header">
                            <span className="card-title">Quick Reference: Agent Creation Checklist</span>
                        </div>
                        <div style={{ padding: 20 }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Prerequisites</h4>
                                    {['AI Provider configured', 'Secrets added at Org level', 'MCP Server started', 'Tools discovered'].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
                                            <div style={{ width: 16, height: 16, border: '2px solid var(--border-color)', borderRadius: 4 }} />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Agent Configuration</h4>
                                    {['Name and description set', 'Model selected', 'Tools/MCP attached', 'Runbook added'].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
                                            <div style={{ width: 16, height: 16, border: '2px solid var(--border-color)', borderRadius: 4 }} />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                                <div>
                                    <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Testing</h4>
                                    {['Basic query works', 'Tools execute correctly', 'Error handling verified', 'Performance acceptable'].map((item, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 4 }}>
                                            <div style={{ width: 16, height: 16, border: '2px solid var(--border-color)', borderRadius: 4 }} />
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* API Testing Card */}
                    <div className="card" style={{ marginTop: 24 }}>
                        <div className="card-header">
                            <span className="card-title">Testing Your Agents</span>
                        </div>
                        <div style={{ padding: 20 }}>
                            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Via API (cURL)</h4>
                            <CodeBlock>{`\`\`\`bash
curl -X POST "http://localhost:8000/api/agents/{AGENT_ID}/query" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "Your test query here", "stream": false}'
\`\`\``}</CodeBlock>

                            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, marginTop: 20 }}>Expected Response</h4>
                            <CodeBlock>{`\`\`\`json
{
  "content": "The final response from the agent",
  "steps": [
    {"type": "thinking", "iteration": 1},
    {"type": "tool_call", "tool": "tool_name", "arguments": {}},
    {"type": "tool_result", "tool": "tool_name", "result": "..."},
    {"type": "final_answer", "content": "..."}
  ],
  "iterations": 2,
  "usage": {"input_tokens": 150, "output_tokens": 200}
}
\`\`\``}</CodeBlock>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
