import { Router } from 'express'
import { env } from '../config'
import { getStoredGitHubToken, githubApiRequest } from '../github'
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth'

type GitHubViewer = {
  login: string
  avatar_url?: string
  html_url?: string
}

type GitHubRepo = {
  full_name: string
  description?: string | null
  html_url: string
  open_issues_count?: number
  stargazers_count?: number
  forks_count?: number
  default_branch?: string
}

type GitHubPullRequest = {
  number: number
  title: string
  state: string
  html_url: string
  user?: { login?: string }
}

type GitHubIssue = {
  number: number
  title: string
  state: string
  html_url: string
  user?: { login?: string }
  pull_request?: object
}

type GitHubContentEntry = {
  type: 'file' | 'dir'
  name: string
  path: string
  html_url?: string | null
  size?: number
  sha?: string
}

type GitHubContentFile = {
  type: 'file'
  name: string
  path: string
  html_url?: string | null
  size?: number
  sha?: string
  encoding?: string
  content?: string
}

function getRepoPath() {
  return `/repos/${encodeURIComponent(env.GITHUB_OWNER)}/${encodeURIComponent(env.GITHUB_REPO)}`
}

export const githubRouter = Router()

githubRouter.use(requireAuth)

githubRouter.get('/overview', async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!env.GITHUB_OWNER || !env.GITHUB_REPO) {
      response.status(503).json({ error: 'GitHub repository is not configured.' })
      return
    }

    const userId = request.auth!.userId
    const token = await getStoredGitHubToken(userId)
    if (!token) {
      response.status(401).json({ error: 'GitHub account is not connected' })
      return
    }

    const repoPath = getRepoPath()

    const [viewer, repo, pulls, issues] = await Promise.all([
      githubApiRequest<GitHubViewer>(userId, '/user'),
      githubApiRequest<GitHubRepo>(userId, repoPath),
      githubApiRequest<GitHubPullRequest[]>(userId, `${repoPath}/pulls?state=open&per_page=10`),
      githubApiRequest<GitHubIssue[]>(userId, `${repoPath}/issues?state=open&per_page=10`),
    ])

    response.json({
      viewer: {
        login: viewer.login,
        avatarUrl: viewer.avatar_url || null,
        profileUrl: viewer.html_url || null,
      },
      repo: {
        fullName: repo.full_name,
        description: repo.description || null,
        url: repo.html_url,
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0,
        openIssuesCount: repo.open_issues_count || 0,
        defaultBranch: repo.default_branch || 'main',
      },
      pulls: pulls.map((pull) => ({
        number: pull.number,
        title: pull.title,
        state: pull.state,
        url: pull.html_url,
        author: pull.user?.login || 'unknown',
      })),
      issues: issues
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          url: issue.html_url,
          author: issue.user?.login || 'unknown',
        })),
    })
  } catch (error) {
    next(error)
  }
})

githubRouter.get('/contents', async (request: AuthenticatedRequest, response, next) => {
  try {
    if (!env.GITHUB_OWNER || !env.GITHUB_REPO) {
      response.status(503).json({ error: 'GitHub repository is not configured.' })
      return
    }

    const userId = request.auth!.userId
    const token = await getStoredGitHubToken(userId)
    if (!token) {
      response.status(401).json({ error: 'GitHub account is not connected' })
      return
    }

    const rawPath = typeof request.query.path === 'string' ? request.query.path : ''
    const normalizedPath = rawPath.replace(/^\/+|\/+$/g, '')
    const apiPath = normalizedPath ? `${getRepoPath()}/contents/${normalizedPath}` : `${getRepoPath()}/contents`
    const payload = await githubApiRequest<GitHubContentEntry[] | GitHubContentFile>(userId, apiPath)

    if (Array.isArray(payload)) {
      response.json({
        kind: 'directory',
        path: normalizedPath,
        entries: payload.map((entry) => ({
          type: entry.type,
          name: entry.name,
          path: entry.path,
          url: entry.html_url || null,
          size: entry.size || 0,
          sha: entry.sha || null,
        })),
      })
      return
    }

    const content =
      payload.type === 'file' && payload.content
        ? payload.encoding === 'base64'
          ? Buffer.from(payload.content, 'base64').toString('utf8')
          : payload.content
        : ''

    response.json({
      kind: 'file',
      path: normalizedPath,
      file: {
        type: payload.type,
        name: payload.name,
        path: payload.path,
        url: payload.html_url || null,
        size: payload.size || 0,
        sha: payload.sha || null,
        content: content.slice(0, 12000),
        truncated: content.length > 12000,
      },
    })
  } catch (error) {
    next(error)
  }
})
