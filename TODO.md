# XPollination MCP Server - TODO

## Priority 1: Unit Tests

### Services

#### RssParser.test.ts
```typescript
describe('RssParser', () => {
  describe('parseFeed', () => {
    it('should parse valid RSS 2.0 feed')
    it('should handle CDATA sections')
    it('should decode HTML entities')
    it('should extract categories')
    it('should handle missing optional fields')
    it('should throw on invalid XML')
    it('should throw on non-RSS content')
  })

  describe('filterByDate', () => {
    it('should filter items older than lookback days')
    it('should include items without dates')
    it('should handle timezone differences')
  })

  describe('parseFeeds', () => {
    it('should fetch multiple feeds in parallel')
    it('should continue on individual feed failures')
    it('should return partial results on errors')
  })
})
```

#### TrendMatcher.test.ts
```typescript
describe('TrendMatcher', () => {
  describe('matchItems', () => {
    it('should match single keyword in title')
    it('should match keyword in description')
    it('should match multi-word keywords')
    it('should be case-insensitive')
    it('should respect exclusion keywords')
    it('should calculate relevance score correctly')
    it('should sort by relevance score')
  })

  describe('calculateTrendScore', () => {
    it('should score recent items higher')
    it('should return 0.5 for items without date')
    it('should decay exponentially over time')
  })

  describe('deduplicateMatches', () => {
    it('should keep highest scoring duplicate')
    it('should preserve unique items')
  })
})
```

#### GitPublisher.test.ts
```typescript
describe('GitPublisher', () => {
  describe('generateFrontmatter', () => {
    it('should generate valid YAML frontmatter')
    it('should escape quotes in title')
    it('should format tags as array')
    it('should handle missing optional fields')
  })

  describe('generateSlug', () => {
    it('should lowercase title')
    it('should replace spaces with hyphens')
    it('should remove special characters')
    it('should limit to 60 characters')
  })

  describe('createPostContent', () => {
    it('should combine frontmatter and content')
    it('should add blank line between frontmatter and content')
  })
})
```

### Repositories

#### FrameRepository.test.ts
```typescript
describe('FrameRepository', () => {
  beforeEach(() => { /* setup in-memory SQLite */ })

  describe('create', () => {
    it('should insert frame with all fields')
    it('should return frame ID')
    it('should set default status to active')
  })

  describe('findById', () => {
    it('should return frame by ID')
    it('should return null for non-existent ID')
  })

  describe('findActive', () => {
    it('should return only active frames')
    it('should exclude paused frames')
    it('should exclude deleted frames')
    it('should order by created_at DESC')
  })

  describe('findAll', () => {
    it('should include paused frames')
    it('should exclude deleted frames')
  })

  describe('update', () => {
    it('should update specified fields')
    it('should set updated_at timestamp')
    it('should not change unspecified fields')
  })

  describe('delete', () => {
    it('should soft delete by setting status')
  })
})
```

#### DraftRepository.test.ts
```typescript
describe('DraftRepository', () => {
  describe('create', () => {
    it('should insert draft with all fields')
    it('should store claims as JSON string')
    it('should set initial version to 1')
  })

  describe('findByStatus', () => {
    it('should filter by status')
    it('should return empty array for no matches')
  })

  describe('update', () => {
    it('should update content')
    it('should increment version')
    it('should update status')
    it('should set updated_at')
  })
})
```

### Tools

#### createFrame.test.ts
```typescript
describe('handleCreateFrame', () => {
  it('should create frame from conversation input')
  it('should generate UUID for frame ID')
  it('should serialize keywords to JSON')
  it('should serialize sources to JSON')
  it('should return success message')
  it('should validate required fields')
})
```

#### crawlTrends.test.ts
```typescript
describe('handleCrawlTrends', () => {
  it('should fetch RSS feeds from frame sources')
  it('should match items against frame keywords')
  it('should filter by lookback days')
  it('should deduplicate results')
  it('should limit results to maxResults')
  it('should handle no active frames')
  it('should handle empty RSS feeds')
})
```

#### factCheck.test.ts
```typescript
describe('handleFactCheck', () => {
  describe('without verificationResults', () => {
    it('should return claims to verify')
    it('should filter claims needing verification')
  })

  describe('with verificationResults', () => {
    it('should calculate pass/fail correctly')
    it('should collect issues from failed claims')
    it('should update draft status on pass')
    it('should keep pending status on fail')
  })
})
```

#### publishPost.test.ts
```typescript
describe('handlePublishPost', () => {
  it('should reject unverified drafts')
  it('should generate slug from title')
  it('should create frontmatter with metadata')
  it('should commit to git repository')
  it('should return post URL')
  it('should update draft status to published')
})
```

## Priority 2: End-to-End Tests

### pipeline.e2e.test.ts
```typescript
describe('Content Pipeline E2E', () => {
  let db: DatabaseContext
  let mockRssServer: MockServer

  beforeAll(async () => {
    // Setup in-memory database
    // Setup mock RSS server
  })

  it('should complete full pipeline from frame to published post', async () => {
    // Step 1: Create frame
    const frame = await handleCreateFrame({
      name: 'Test Frame',
      description: 'Test description',
      keywords: ['test', 'keyword'],
      sources: { rss: ['http://mock-rss/feed.xml'] },
      audience: 'testers',
      tone: 'technical'
    }, db.frameRepo)
    expect(frame.id).toBeDefined()

    // Step 2: Crawl trends
    const trends = await handleCrawlTrends({
      frameIds: [frame.id],
      lookbackDays: 7,
      maxResults: 5
    }, db.frameRepo)
    expect(trends.trendingTopics.length).toBeGreaterThan(0)

    // Step 3: Propose topic
    const proposals = await handleProposeTopic({
      trendingTopics: trends.trendingTopics
    }, db.frameRepo)
    expect(proposals.proposals.length).toBeGreaterThan(0)

    // Step 4: Write draft
    const draft = await handleWriteDraft({
      title: 'Test Post',
      frameId: frame.id,
      content: '# Test\n\nThis is a test post.',
      claims: [{ text: 'Test claim', needsVerification: true }]
    }, db)
    expect(draft.draftId).toBeDefined()
    expect(draft.status).toBe('pending_verification')

    // Step 5: Fact check
    const checkResult = await handleFactCheck({
      draftId: draft.draftId,
      verificationResults: [{
        claimText: 'Test claim',
        verdict: 'TRUE',
        confidence: 0.9
      }]
    }, db)
    expect(checkResult.verificationReport?.pass).toBe(true)

    // Step 6: Verify draft status updated
    const verifiedDraft = await db.draftRepo.findById(draft.draftId)
    expect(verifiedDraft?.status).toBe('verified')

    // Step 7: Publish (with mocked git)
    // ... mock GitPublisher
  })

  it('should handle fact check failure and improvement loop', async () => {
    // Create draft with false claim
    // Fact check → fail
    // Improve draft
    // Re-check → pass
  })

  it('should handle empty RSS feeds gracefully', async () => {
    // Setup mock RSS with no items
    // Crawl trends
    // Verify empty results with helpful message
  })

  it('should respect frame exclusions', async () => {
    // Create frame with exclusions
    // Mock RSS with items matching exclusions
    // Verify excluded items not in results
  })
})
```

## Priority 3: Integration Tests

### MCP Server Integration
```typescript
describe('MCP Server Integration', () => {
  it('should list all tools')
  it('should handle tool calls')
  it('should list all resources')
  it('should read resource by URI')
  it('should return error for unknown tool')
  it('should return error for unknown resource')
})
```

## Priority 4: Future Implementation

### Not Yet Implemented
- [ ] TrendRepository (currently stub)
- [ ] WorkflowRepository (currently stub)
- [ ] Google Trends API integration
- [ ] Web search service for fact-checking
- [ ] Draft versioning (draft_versions table)
- [ ] Workflow history tracking

### Infrastructure
- [ ] Hugo site setup
- [ ] GitHub Actions deployment
- [ ] Systemd service configuration
- [ ] Health check endpoint

## Test Configuration

### vitest.config.ts
```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts']
    }
  }
})
```

### Test Utilities Needed
- In-memory SQLite setup helper
- Mock RSS server
- Mock Git repository
- Test data fixtures (frames, drafts, RSS items)
