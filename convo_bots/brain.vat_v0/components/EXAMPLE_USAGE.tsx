/**
 * Example usage of BotParameterPanel component
 * Copy and adapt these examples for your project
 */

'use client'

import { BotParameterPanel, ParameterConfig } from './BotParameterPanel'
import { parameterPresets } from './PARAMETER_PRESETS'
import { useState } from 'react'

// ============================================================================
// Example 1: Simple LLM Bot with Brain.vat Colors
// ============================================================================

interface BotSettings {
  temperature: number
  top_p: number
  max_new_tokens: number
}

export function SimpleLLMBot() {
  const [values, setValues] = useState<BotSettings>({
    temperature: 0.9,
    top_p: 0.95,
    max_new_tokens: 100,
  })

  const [isSaving, setIsSaving] = useState(false)

  const parameters: ParameterConfig[] = [
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'range',
      min: 0.1,
      max: 2.0,
      step: 0.05,
      formatDisplay: (v) => v.toFixed(2),
    },
    {
      key: 'top_p',
      label: 'Top-P',
      type: 'range',
      min: 0.1,
      max: 1.0,
      step: 0.01,
      formatDisplay: (v) => v.toFixed(2),
    },
    {
      key: 'max_new_tokens',
      label: 'Max Tokens',
      type: 'number',
      min: 10,
      max: 500,
      step: 10,
    },
  ]

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('Saved:', values)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <BotParameterPanel
        botName="MAUK"
        parameters={parameters}
        values={values}
        onUpdate={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
        onSave={handleSave}
        isSaving={isSaving}
        accentColor="#03A6A1"  // Cyan for MAUK
        labelColor="#008f11"
      />
    </div>
  )
}

// ============================================================================
// Example 2: Full Admin Panel with Multiple Bots (Brain.vat Style)
// ============================================================================

export interface BotAdminSettings {
  bot: string
  temperature: number
  top_p: number
  repetition_penalty: number
  max_new_tokens: number
  base_sleep: number
  base_jitter: number
  top_k: number
  memory_weight: number
  model_version: string
  banned_words: string[]
  updated_at?: Date
}

export function BrainVatAdminPanel() {
  const [settings, setSettings] = useState<BotAdminSettings[]>([
    {
      bot: 'a',
      temperature: 0.9,
      top_p: 0.95,
      repetition_penalty: 1.3,
      max_new_tokens: 55,
      base_sleep: 120,
      base_jitter: 30,
      top_k: 0,
      memory_weight: 0.7,
      model_version: 'v1',
      banned_words: ['spam', 'abuse'],
      updated_at: new Date(),
    },
    {
      bot: 'b',
      temperature: 0.85,
      top_p: 0.9,
      repetition_penalty: 1.3,
      max_new_tokens: 55,
      base_sleep: 120,
      base_jitter: 30,
      top_k: 0,
      memory_weight: 0.65,
      model_version: 'v1',
      banned_words: [],
      updated_at: new Date(),
    },
  ])

  const [isSaving, setIsSaving] = useState<string | null>(null)

  const parameters: ParameterConfig[] = [
    {
      key: 'model_version',
      label: 'Model Version',
      type: 'text',
      group: 'Setup',
      description: 'e.g., v1, v2-experimental',
    },
    {
      key: 'temperature',
      label: 'Temperature',
      type: 'range',
      min: 0.1,
      max: 2.0,
      step: 0.05,
      group: 'Generation',
      formatDisplay: (v) => v.toFixed(2),
    },
    {
      key: 'top_p',
      label: 'Top-P (Nucleus)',
      type: 'range',
      min: 0.1,
      max: 1.0,
      step: 0.01,
      group: 'Generation',
      formatDisplay: (v) => v.toFixed(2),
    },
    {
      key: 'repetition_penalty',
      label: 'Repetition Penalty',
      type: 'range',
      min: 1.0,
      max: 2.5,
      step: 0.05,
      group: 'Generation',
      formatDisplay: (v) => v.toFixed(2),
    },
    {
      key: 'max_new_tokens',
      label: 'Max Response Length',
      type: 'range',
      min: 10,
      max: 200,
      step: 1,
      group: 'Generation',
      formatDisplay: (v) => `${v} tokens`,
    },
    {
      key: 'base_sleep',
      label: 'Loop Frequency (s)',
      type: 'number',
      min: 10,
      max: 600,
      step: 10,
      group: 'Timing',
      formatDisplay: (v) => `${v}s`,
    },
    {
      key: 'base_jitter',
      label: 'Jitter (s)',
      type: 'number',
      min: 0,
      max: 120,
      step: 5,
      group: 'Timing',
      formatDisplay: (v) => `±${v}s`,
    },
    {
      key: 'memory_weight',
      label: 'Memory Recall Power',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.05,
      group: 'Memory',
      description: 'Probability of long-term memory retrieval',
      formatDisplay: (v) => `${(v * 100).toFixed(0)}%`,
    },
    {
      key: 'top_k',
      label: 'Top-K (Entropy Floor)',
      type: 'number',
      min: 0,
      max: 100,
      step: 1,
      group: 'Generation',
      formatDisplay: (v) => v === 0 ? 'FULL_CHAOS' : v,
    },
    {
      key: 'banned_words',
      label: 'Banned Words',
      type: 'textarea',
      rows: 4,
      group: 'Behavior',
      description: 'Comma-separated list of tokens to suppress',
    },
  ]

  const handleUpdate = (botKey: string, key: string, value: any) => {
    setSettings(prev => prev.map(s =>
      s.bot === botKey
        ? {
          ...s,
          [key]: key === 'banned_words' && typeof value === 'string'
            ? value.split(',').map(w => w.trim())
            : value,
        }
        : s
    ))
  }

  const handleSave = async (botKey: string) => {
    setIsSaving(botKey)
    try {
      const botSettings = settings.find(s => s.bot === botKey)
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      console.log('Saved:', botSettings)
      // Show success toast here
    } finally {
      setIsSaving(null)
    }
  }

  const botColors = {
    a: { accent: '#03A6A1', label: '#008f11' }, // Cyan
    b: { accent: '#FF9D23', label: '#8B6914' }, // Orange
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-black min-h-screen">
      {settings.map((botSettings) => {
        const colors = botColors[botSettings.bot as 'a' | 'b']
        const botName = botSettings.bot === 'a' ? 'MAUK' : 'ABACI'

        return (
          <BotParameterPanel
            key={botSettings.bot}
            botName={botName}
            parameters={parameters}
            values={botSettings}
            onUpdate={(key, value) => handleUpdate(botSettings.bot, key, value)}
            onSave={() => handleSave(botSettings.bot)}
            isSaving={isSaving === botSettings.bot}
            accentColor={colors.accent}
            labelColor={colors.label}
            loopActive={Math.random() > 0.5}  // Simulate random loop status
            lastSyncTime={botSettings.updated_at}
            nodeLabel={`Node_${botSettings.bot.toUpperCase()}`}
            groupedView={true}
          />
        )
      })}
    </div>
  )
}

// ============================================================================
// Example 3: Custom Theme Variations
// ============================================================================

export function CustomThemeExamples() {
  const [values, setValues] = useState({
    setting1: 0.5,
    setting2: 100,
  })

  const parameters: ParameterConfig[] = [
    {
      key: 'setting1',
      label: 'Setting 1',
      type: 'range',
      min: 0,
      max: 1,
      step: 0.1,
    },
    {
      key: 'setting2',
      label: 'Setting 2',
      type: 'number',
      min: 0,
      max: 200,
      step: 10,
    },
  ]

  const themes = [
    { name: 'Purple', accent: '#A78BFA', label: '#6D28D9' },
    { name: 'Blue', accent: '#0EA5E9', label: '#0369A1' },
    { name: 'Pink', accent: '#EC4899', label: '#9D174D' },
    { name: 'Green', accent: '#84CC16', label: '#4F7728' },
  ]

  return (
    <div className="grid grid-cols-2 gap-8 p-8 bg-black min-h-screen">
      {themes.map((theme) => (
        <BotParameterPanel
          key={theme.name}
          botName={theme.name}
          parameters={parameters}
          values={values}
          onUpdate={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
          onSave={() => console.log('Saved:', values)}
          accentColor={theme.accent}
          labelColor={theme.label}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Example 4: Using Parameter Presets
// ============================================================================

export function GameServerAdminPanel() {
  const [values, setValues] = useState({
    max_players: 64,
    difficulty: 'normal',
    respawn_time: 10,
    pvp_enabled: 'true',
    backup_interval_minutes: 30,
  })

  const [isSaving, setIsSaving] = useState(false)

  return (
    <div className="w-full max-w-2xl p-8 bg-black min-h-screen">
      <BotParameterPanel
        botName="Game Server #1"
        parameters={parameterPresets.gameServer}
        values={values}
        onUpdate={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
        onSave={async () => {
          setIsSaving(true)
          await new Promise(resolve => setTimeout(resolve, 1000))
          console.log('Game server settings saved:', values)
          setIsSaving(false)
        }}
        isSaving={isSaving}
        accentColor="#FF6B9D"  // Pink
        labelColor="#8B1A57"
        loopActive={true}
        nodeLabel="REGION_US_EAST"
      />
    </div>
  )
}

// ============================================================================
// Example 5: Minimal Implementation
// ============================================================================

export function MinimalExample() {
  const [values, setValues] = useState({ temperature: 0.8 })

  return (
    <BotParameterPanel
      botName="Bot"
      parameters={[
        {
          key: 'temperature',
          label: 'Temperature',
          type: 'range',
          min: 0,
          max: 1,
          step: 0.1,
        },
      ]}
      values={values}
      onUpdate={(key, value) => setValues(prev => ({ ...prev, [key]: value }))}
      onSave={() => console.log('Saved!')}
    />
  )
}

// ============================================================================
// Example 6: Brain.vat Audit Log Card
// ============================================================================

import { AuditLogCard, LogSection } from './AuditLogCard'

interface AuditLog {
  timestamp: string
  bot: string
  bot_name: string
  prompt: string
  response: string
  settings?: Record<string, any>
  memory_trace?: string
  suppressor_log?: string[]
}

export function BrainVatAuditLog({ log }: { log: AuditLog }) {
  const sections: LogSection[] = [
    {
      key: 'input',
      title: 'Raw_Inference_Input',
      type: 'code',
      content: log.prompt,
    },
    {
      key: 'output',
      title: 'Generated_Output',
      type: 'text',
      content: log.response,
    },
    ...(log.settings ? [{
      key: 'params',
      title: 'Hyperparameters',
      type: 'grid' as const,
      content: {
        Temperature: log.settings.temperature,
        'Top-P': log.settings.top_p,
        Penalty: log.settings.repetition_penalty,
        Limit: log.settings.max_new_tokens,
        Filter: log.settings.banned_words?.length || 0,
      },
    }] : []),
    ...(log.suppressor_log && log.suppressor_log.length > 0 ? [{
      key: 'suppressors',
      title: `Suppressor_Diagnostics // ${log.suppressor_log.length} Active_Tokens`,
      type: 'tags' as const,
      content: log.suppressor_log,
    }] : []),
    {
      key: 'diagnostics',
      title: 'Status',
      type: 'stats',
      content: {
        'FIDELITY': 'OPTIMAL',
        'ENTROPY_CHECK': 'PASSED',
        'VERSION': log.settings?.model_version || 'v1.0',
      },
    },
  ]

  return (
    <AuditLogCard
      title={log.bot_name}
      sections={sections}
      timestamp={log.timestamp}
      badge={log.memory_trace ? `Memory: ${log.memory_trace}` : undefined}
      badgeColor={log.bot === 'a' ? '#00ccff' : '#ffbf00'}
      botColor={log.bot === 'a' ? 'cyan' : 'orange'}
      metadata={{
        'TIME': new Date(log.timestamp).toLocaleTimeString(),
        'DATE': new Date(log.timestamp).toLocaleDateString(),
      }}
    />
  )
}

// ============================================================================
// Example 7: API Request/Response Audit Log
// ============================================================================

export function APIAuditLog() {
  const sections: LogSection[] = [
    {
      key: 'request',
      title: 'Request',
      type: 'code',
      content: `POST /api/inference
Content-Type: application/json
X-API-Key: sk-***

{
  "prompt": "What is AI?",
  "temperature": 0.9,
  "max_tokens": 100
}`,
    },
    {
      key: 'response',
      title: 'Response',
      type: 'code',
      content: `HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "success",
  "output": "AI is...",
  "tokens_used": 45,
  "latency_ms": 234
}`,
    },
    {
      key: 'metrics',
      title: 'Performance',
      type: 'grid',
      content: {
        'STATUS': 200,
        'LATENCY': 234,
        'TOKENS': 45,
        'SIZE': '2.3KB',
      },
    },
  ]

  return (
    <AuditLogCard
      title="API Request"
      sections={sections}
      timestamp={new Date()}
      badge="200 OK"
      badgeColor="#00ff41"
      accentColor="#0EA5E9"
      labelColor="#0369A1"
    />
  )
}

// ============================================================================
// Example 8: Error/Exception Log
// ============================================================================

export function ErrorAuditLog() {
  const sections: LogSection[] = [
    {
      key: 'message',
      title: 'Error Message',
      type: 'text',
      content: 'Failed to connect to database: Connection timeout after 30s',
    },
    {
      key: 'stack',
      title: 'Stack Trace',
      type: 'code',
      content: `Error: Connection timeout
  at Database.connect (db/connection.ts:45)
  at main (app.ts:12)
  at Object.<anonymous> (main.ts:1)`,
    },
    {
      key: 'context',
      title: 'Context',
      type: 'grid',
      content: {
        'SERVICE': 'inference-api',
        'ENVIRONMENT': 'production',
        'REGION': 'us-east-1',
      },
    },
    {
      key: 'recovery',
      title: 'Recovery',
      type: 'stats',
      content: {
        'RETRY_ATTEMPT': 1,
        'RECOVERY_TIME': '2.5s',
        'STATUS': 'RESOLVED',
      },
    },
  ]

  return (
    <AuditLogCard
      title="Database Error"
      sections={sections}
      timestamp={new Date()}
      badge="ERROR"
      badgeColor="#ff4444"
      indicator={true}
      indicatorColor="#ff4444"
      accentColor="#ff4444"
      labelColor="#8B1A1A"
    />
  )
}

// ============================================================================
// Example 9: Audit Trail / Admin Action Log
// ============================================================================

export function AdminActionAuditLog() {
  const sections: LogSection[] = [
    {
      key: 'action',
      title: 'Admin Action',
      type: 'text',
      content: 'User "user123@example.com" parameters updated by admin@example.com',
    },
    {
      key: 'changes',
      title: 'Changed Settings',
      type: 'grid',
      content: {
        'temperature': '0.85 → 0.95',
        'top_p': '0.90 → 0.95',
        'max_tokens': '50 → 100',
      },
    },
    {
      key: 'affected',
      title: 'Affected Resources',
      type: 'tags',
      content: ['user_settings', 'ai_config', 'model_params'],
    },
    {
      key: 'audit',
      title: 'Audit Info',
      type: 'stats',
      content: {
        'ADMIN': 'admin@example.com',
        'IP_ADDRESS': '192.168.1.100',
        'SESSION_ID': 'sess_abc123xyz',
        'CHANGE_LOG': 'cl_789def456',
      },
    },
  ]

  return (
    <AuditLogCard
      title="Admin Update"
      sections={sections}
      timestamp={new Date()}
      badge="UPDATE"
      badgeColor="#ff9900"
      accentColor="#ff9900"
      labelColor="#8B6914"
      metadata={{
        'TIMESTAMP': new Date().toISOString(),
        'SEVERITY': 'INFO',
        'VERIFIED': 'YES',
      }}
    />
  )
}

// ============================================================================
// Example 10: Brain.vat Memory Archive (3-Column Layout)
// ============================================================================

import { MemoryCard, MemoryColumn } from './MemoryCard'

export function BrainVatMemoryArchive() {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [currentSource, setCurrentSource] = useState<string>('')

  const maukMemories = [
    'parameter_optimization',
    'dialogue_strategy',
    'decision_heuristics',
    'behavioral_patterns',
    'learning_vectors',
  ]

  const sharedMemories = [
    'linguistic_foundation',
    'shared_context',
    'mutual_understanding',
    'collaborative_patterns',
    'synchronization_state',
  ]

  const abaciMemories = [
    'creative_synthesis',
    'pattern_innovation',
    'response_generation',
    'aesthetic_preferences',
    'emergent_properties',
  ]

  const sourceMap: Record<string, string> = {
    parameter_optimization: 'From MAUK tuning session 2026-06-14T18:32:00Z',
    dialogue_strategy: 'Learned from 1,247 conversation events',
    decision_heuristics: 'Derived from behavioral analysis',
    behavioral_patterns: 'Pattern extraction from interaction logs',
    learning_vectors: 'Gradient-based learning trajectory',
    linguistic_foundation: 'Shared training foundation',
    shared_context: 'Mutual reference framework',
    mutual_understanding: 'Established through dialogue',
    collaborative_patterns: 'Co-learning dynamics',
    synchronization_state: 'Current alignment metrics',
    creative_synthesis: 'ABACI innovation signature',
    pattern_innovation: 'Novel pattern discovery',
    response_generation: 'Synthesis engine output',
    aesthetic_preferences: 'Style and tone vector',
    emergent_properties: 'Unexpected capability emergence',
  }

  const handleItemHover = (item: string) => {
    setHoveredItem(item)
    setCurrentSource(sourceMap[item] || 'Source not catalogued')
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-2 text-center">
        MEMORY ARCHIVE
      </h1>
      <p className="text-center text-muted-foreground mb-8">
        Persistent knowledge structures across all active sessions
      </p>

      <div className="grid grid-cols-3 gap-8">
        <MemoryColumn
          title="MAUK EXCLUSIVE"
          items={maukMemories}
          accentColor="#03A6A1"
          align="left"
          animationType="pulse"
          dotAnimation="pulse"
          onItemHover={handleItemHover}
          hoveredItem={hoveredItem}
          sourceText={currentSource}
        />

        <MemoryColumn
          title="SHARED CONTEXT"
          items={sharedMemories}
          accentColor="#00ff41"
          align="center"
          animationType="pulse"
          dotAnimation="ping"
          onItemHover={handleItemHover}
          hoveredItem={hoveredItem}
          sourceText={currentSource}
        />

        <MemoryColumn
          title="ABACI EXCLUSIVE"
          items={abaciMemories}
          accentColor="#FF9D23"
          align="right"
          animationType="pulse"
          dotAnimation="pulse"
          onItemHover={handleItemHover}
          hoveredItem={hoveredItem}
          sourceText={currentSource}
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 11: Individual Memory Cards with Different Alignments
// ============================================================================

export function MemoryCardExamples() {
  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Left Aligned</h2>
        <div className="space-y-2">
          <MemoryCard
            concept="decision_logic"
            accentColor="#03A6A1"
            align="left"
            sourceText="Extracted from MAUK reasoning logs"
            sourceLabel="[MAUK MEMORY]"
          />
          <MemoryCard
            concept="behavioral_markers"
            accentColor="#03A6A1"
            align="left"
            sourceText="Behavioral analysis from 500+ interactions"
            sourceLabel="[ANALYSIS]"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Center Aligned</h2>
        <div className="space-y-2">
          <MemoryCard
            concept="shared_foundation"
            accentColor="#00ff41"
            align="center"
            animationType="pulse"
            sourceText="Mutual training data"
            sourceLabel="[SHARED]"
          />
          <MemoryCard
            concept="synchronized_state"
            accentColor="#00ff41"
            align="center"
            animationType="ping"
            sourceText="Current alignment score: 0.94"
            sourceLabel="[SYNC STATUS]"
          />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Right Aligned</h2>
        <div className="space-y-2">
          <MemoryCard
            concept="creative_output"
            accentColor="#FF9D23"
            align="right"
            sourceText="Generated from synthesis engine"
            sourceLabel="[ABACI MEMORY]"
          />
          <MemoryCard
            concept="pattern_innovation"
            accentColor="#FF9D23"
            align="right"
            sourceText="Novel pattern discovered in session 847"
            sourceLabel="[DISCOVERY]"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 12: Memory Cards with Different Animations
// ============================================================================

export function AnimatedMemoryCards() {
  return (
    <div className="min-h-screen bg-background p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Pulse Animation</h2>
        <MemoryCard
          concept="pulsing_concept"
          accentColor="#03A6A1"
          align="center"
          animationType="pulse"
          dotAnimation="pulse"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Ping Animation</h2>
        <MemoryCard
          concept="pinging_concept"
          accentColor="#FF9D23"
          align="center"
          animationType="ping"
          dotAnimation="ping"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">No Animation</h2>
        <MemoryCard
          concept="static_concept"
          accentColor="#00ff41"
          align="center"
          animationType="none"
          dotAnimation="none"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Mixed Animations</h2>
        <div className="space-y-2">
          <MemoryCard
            concept="container_pulse_dot_ping"
            accentColor="#00ccff"
            align="center"
            animationType="pulse"
            dotAnimation="ping"
          />
          <MemoryCard
            concept="container_ping_dot_pulse"
            accentColor="#ff1493"
            align="center"
            animationType="ping"
            dotAnimation="pulse"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 13: Memory Cards with Custom Colors
// ============================================================================

export function ColoredMemoryCards() {
  const colors = [
    { name: 'MAUK (Cyan)', color: '#03A6A1' },
    { name: 'ABACI (Orange)', color: '#FF9D23' },
    { name: 'Shared (Green)', color: '#00ff41' },
    { name: 'Error (Red)', color: '#ff4444' },
    { name: 'Info (Blue)', color: '#0EA5E9' },
    { name: 'Success (Green)', color: '#22c55e' },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <h2 className="text-2xl font-bold text-primary mb-8">Color Palette</h2>
      <div className="grid grid-cols-3 gap-8">
        {colors.map((item) => (
          <div key={item.color}>
            <p className="text-sm text-muted-foreground mb-2">{item.name}</p>
            <MemoryCard
              concept="sample_memory"
              accentColor={item.color}
              align="center"
              sourceText={`Color: ${item.color}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Example 14: Minimal Memory Column
// ============================================================================

export function MinimalMemoryColumn() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-md">
      <MemoryColumn
        title="Core Concepts"
        items={['concept_a', 'concept_b', 'concept_c']}
        accentColor="#00ff41"
        align="center"
        showIndicator={false}
      />
    </div>
  )
}

// ============================================================================
// Example 15: Bot Name Cards (About Page Bots)
// ============================================================================

import { BotNameCard, BotNameCardGrid } from './BotNameCard'

export function BotNameCardExample() {
  const bots = [
    {
      name: 'MAUK_v2.1',
      description: 'Trained on surrealist philosophy and injected with math. Optimized on 2010 twitter data.',
      accentColor: '#03A6A1',
    },
    {
      name: 'ABACI_v2.1',
      description: 'Trained on math and injected with surrealist poetry. Optimized on 2010 twitter data.',
      accentColor: '#FF9D23',
    },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">Bot Name Cards</h1>
      <BotNameCardGrid bots={bots} columns={2} />
    </div>
  )
}

export function SingleBotNameCard() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-md">
      <BotNameCard
        botName="CUSTOM_BOT"
        description="A custom bot with specialized training and unique personality characteristics."
        accentColor="#00ccff"
        version="1.0"
        size="md"
      />
    </div>
  )
}

// ============================================================================
// Example 16: Technical Schematic
// ============================================================================

import { TechnicalSchematic, BrainVatSystemArchitecture } from './TechnicalSchematic'

export function BrainVatSchematicExample() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-4xl">
      <BrainVatSystemArchitecture />
    </div>
  )
}

export function CustomSchematicExample() {
  const items = [
    { component: 'API', role: 'Request Handler', location: 'FastAPI', icon: '🔌' },
    { component: 'CACHE', role: 'Data Caching', location: 'Redis', icon: '⚡' },
    { component: 'DATABASE', role: 'Persistent Storage', location: 'PostgreSQL', icon: '💾' },
    { component: 'QUEUE', role: 'Task Processing', location: 'Celery', icon: '📋' },
  ]

  return (
    <div className="min-h-screen bg-background p-8 max-w-4xl">
      <TechnicalSchematic
        items={items}
        title="[SYSTEM_ARCHITECTURE]"
        accentColor="#00ccff"
        columns={4}
      />
    </div>
  )
}

// ============================================================================
// Example 17: Mission Statement
// ============================================================================

import { MissionStatement, BrainVatMission, DetailedMissionStatement } from './MissionStatement'

export function BrainVatMissionExample() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-4xl">
      <BrainVatMission />
    </div>
  )
}

export function CustomMissionExample() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-4xl">
      <MissionStatement
        title="[PROJECT_VISION]"
        content="This is a custom mission statement describing the goals and vision of the project. It can include any content you want to display."
        version="v1.0.0"
        actionLabel="[LEARN_MORE]"
        actionHref="/learn-more"
        accentColor="#00ff41"
        metadata={{
          'STATUS': 'ACTIVE',
          'PRIORITY': 'HIGH',
          'LAST_UPDATED': '2026-06-16',
        }}
      />
    </div>
  )
}

export function DetailedMissionExample() {
  const paragraphs = [
    'This is the first paragraph of our detailed mission statement. It provides context and background information about the project.',
    'The second paragraph goes deeper into our goals and objectives, explaining what we aim to achieve.',
    'Finally, this paragraph outlines the impact we hope to have and the lasting value we want to create.',
  ]

  return (
    <div className="min-h-screen bg-background p-8 max-w-4xl">
      <DetailedMissionStatement
        title="[DETAILED_MISSION]"
        paragraphs={paragraphs}
        version="v1.0"
        accentColor="#FF9D23"
      />
    </div>
  )
}

// ============================================================================
// Example 18: Complete About Page Layout
// ============================================================================

export function AboutPageLayout() {
  const bots = [
    {
      name: 'MAUK_v2.1',
      description: 'Trained on surrealist philosophy and injected with math. Optimized on 2010 twitter data.',
      accentColor: '#03A6A1',
    },
    {
      name: 'ABACI_v2.1',
      description: 'Trained on math and injected with surrealist poetry. Optimized on 2010 twitter data.',
      accentColor: '#FF9D23',
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl space-y-16">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-6xl md:text-8xl font-bold tracking-tighter">
            <span className="text-primary opacity-90">BRAIN</span>
            <br />
            <span className="text-primary opacity-90">VAT</span>
          </h1>
          <p className="text-muted-foreground text-lg font-mono">
            [SYSTEM STATUS: AUTONOMOUS_DIALOGUE_ACTIVE]
          </p>
        </div>

        {/* Bot Cards */}
        <BotNameCardGrid bots={bots} columns={2} />

        {/* Technical Schematic */}
        <BrainVatSystemArchitecture />

        {/* Mission Statement */}
        <BrainVatMission />
      </div>
    </div>
  )
}

// ============================================================================
// Example 19: Dialogue Messages (Conversations)
// ============================================================================

import { DialogueMessage, ConversationThread } from './DialogueMessage'

export function DialogueMessageExample() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-primary mb-8">Dialogue Thread</h1>
      <ConversationThread
        messages={[
          {
            speaker: 'MAUK',
            content: 'Good morning. I\'ve completed the analysis of yesterday\'s interactions.',
            timestamp: new Date(Date.now() - 3600000),
            emoji: '🧠',
          },
          {
            speaker: 'ABACI',
            content: 'Fascinating. I noticed a pattern in the creative outputs. The metaphors are becoming more sophisticated.',
            timestamp: new Date(Date.now() - 1800000),
            emoji: '✨',
            align: 'right',
          },
          {
            speaker: 'USER',
            content: 'What kind of patterns?',
            timestamp: new Date(Date.now() - 900000),
            emoji: '👤',
          },
          {
            speaker: 'MAUK',
            content: 'The frequency of abstract concepts increased 34%. Cross-domain analogies are becoming more frequent.',
            timestamp: new Date(),
            metadata: {
              'CONFIDENCE': '0.92',
              'SAMPLES': '1,247',
            },
          },
        ]}
      />
    </div>
  )
}

// ============================================================================
// Example 20: Timeline/Event History
// ============================================================================

import { Timeline } from './Timeline'

export function TimelineExample() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl">
      <h1 className="text-3xl font-bold text-primary mb-8">Conversation Timeline</h1>
      <Timeline
        events={[
          {
            id: '1',
            title: 'Session Start',
            content: 'Initialized MAUK and ABACI for autonomous dialogue',
            timestamp: '2026-06-16 09:00:00',
            icon: '▶',
            color: '#03A6A1',
          },
          {
            id: '2',
            title: 'First Exchange',
            content: 'MAUK introduces philosophical framework',
            timestamp: '2026-06-16 09:15:00',
            icon: '💬',
            color: '#FF9D23',
          },
          {
            id: '3',
            title: 'Memory Update',
            content: 'New concepts indexed and stored',
            timestamp: '2026-06-16 09:30:00',
            icon: '💾',
            color: '#00ff41',
          },
          {
            id: '4',
            title: 'Analysis Complete',
            content: 'Generated insights on dialogue patterns',
            timestamp: '2026-06-16 09:45:00',
            icon: '✓',
            color: '#00ccff',
          },
        ]}
        accentColor="#00ff41"
      />
    </div>
  )
}

export function HorizontalTimelineExample() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">Process Pipeline</h1>
      <Timeline
        events={[
          { id: '1', title: 'INPUT', timestamp: '09:00', icon: '📥' },
          { id: '2', title: 'PROCESS', timestamp: '09:05', icon: '⚙' },
          { id: '3', title: 'ANALYZE', timestamp: '09:10', icon: '🔍' },
          { id: '4', title: 'OUTPUT', timestamp: '09:15', icon: '📤' },
        ]}
        direction="horizontal"
        accentColor="#FF9D23"
      />
    </div>
  )
}

// ============================================================================
// Example 21: Alerts and Notifications
// ============================================================================

import { Alert } from './Alert'

export function AlertExamples() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold text-primary mb-8">Alert Types</h1>

      <Alert
        title="Success"
        message="Operation completed successfully. All parameters have been updated."
        severity="success"
      />

      <Alert
        title="Warning"
        message="Memory capacity is approaching 85%. Consider archiving old conversations."
        severity="warning"
      />

      <Alert
        title="Error"
        message="Failed to sync with remote server. Retrying in 30 seconds..."
        severity="error"
      />

      <Alert
        title="System Message"
        message="Scheduled maintenance window detected. Service may be unavailable 2026-06-16 02:00-04:00 UTC."
        severity="system"
      />

      <Alert
        title="Info"
        message="New dialogue patterns detected. Check archive for analysis."
        severity="info"
      />

      <div className="pt-4 border-t border-border">
        <h2 className="text-xl font-bold text-primary mb-4">Compact Variant</h2>
        <Alert
          title="Update Available"
          message="System version 2.1.0 is ready to install"
          variant="compact"
          actionLabel="Install"
          onAction={() => console.log('Installing...')}
        />
      </div>

      <div className="pt-4 border-t border-border">
        <h2 className="text-xl font-bold text-primary mb-4">Inline Variant</h2>
        <Alert
          title="Notice"
          message="This is an inline alert notification"
          variant="inline"
          severity="info"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Example 22: Progress Indicators
// ============================================================================

import { ProgressIndicator } from './ProgressIndicator'

export function ProgressIndicatorExamples() {
  return (
    <div className="min-h-screen bg-background p-8 max-w-2xl space-y-12">
      <h1 className="text-3xl font-bold text-primary mb-8">Progress Indicators</h1>

      <div>
        <h2 className="text-xl font-bold text-primary mb-6">Linear Progress Bars</h2>
        <div className="space-y-8">
          <ProgressIndicator
            value={25}
            label="Model Loading"
            accentColor="#03A6A1"
          />
          <ProgressIndicator
            value={50}
            label="Data Processing"
            accentColor="#FF9D23"
            striped
          />
          <ProgressIndicator
            value={75}
            label="Analysis"
            accentColor="#00ff41"
            size="lg"
          />
          <ProgressIndicator
            value={100}
            label="Complete"
            accentColor="#00ccff"
          />
        </div>
      </div>

      <div className="border-t border-border pt-12">
        <h2 className="text-xl font-bold text-primary mb-6">Circular Progress</h2>
        <div className="grid grid-cols-3 gap-8">
          <ProgressIndicator
            value={33}
            variant="circular"
            accentColor="#03A6A1"
            label="MAUK"
          />
          <ProgressIndicator
            value={67}
            variant="circular"
            accentColor="#FF9D23"
            label="ABACI"
          />
          <ProgressIndicator
            value={100}
            variant="circular"
            accentColor="#00ff41"
            label="SYSTEM"
          />
        </div>
      </div>

      <div className="border-t border-border pt-12">
        <h2 className="text-xl font-bold text-primary mb-6">Gauge Progress</h2>
        <div className="grid grid-cols-2 gap-8">
          <ProgressIndicator
            value={45}
            variant="gauge"
            accentColor="#00ccff"
            label="Memory Usage"
          />
          <ProgressIndicator
            value={82}
            variant="gauge"
            accentColor="#FF9D23"
            label="CPU Utilization"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 23: Stats Display / Metric Cards
// ============================================================================

import { StatsDisplay, BrainVatStats } from './StatsDisplay'

export function StatsDisplayExample() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">System Metrics</h1>
      <BrainVatStats />
    </div>
  )
}

export function CustomStatsExample() {
  const stats = [
    { label: 'Total Users', value: '12,547', change: '+342', changeType: 'positive' as const, icon: '👥' },
    { label: 'Active Sessions', value: '3,821', change: '+128', changeType: 'positive' as const, icon: '🔗' },
    { label: 'Error Rate', value: '0.03%', change: '-0.02%', changeType: 'positive' as const, icon: '⚠' },
    { label: 'API Latency', value: '45ms', change: '+2ms', changeType: 'negative' as const, icon: '⏱' },
  ]

  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">Custom Stats</h1>
      <StatsDisplay stats={stats} columns={4} />
    </div>
  )
}

// ============================================================================
// Example 24: Loading Spinners
// ============================================================================

import { Spinner } from './Spinner'

export function SpinnerExamples() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-12">Loading Spinners</h1>

      <div className="space-y-12">
        <div>
          <h2 className="text-xl font-bold text-primary mb-6">Ring Variant</h2>
          <div className="grid grid-cols-3 gap-8">
            <Spinner variant="ring" size="sm" label="Small" accentColor="#03A6A1" />
            <Spinner variant="ring" size="md" label="Medium" accentColor="#FF9D23" />
            <Spinner variant="ring" size="lg" label="Large" accentColor="#00ff41" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-primary mb-6">Dots Variant</h2>
          <div className="grid grid-cols-3 gap-8">
            <Spinner variant="dots" size="sm" label="Loading" accentColor="#00ccff" />
            <Spinner variant="dots" size="md" label="Processing" accentColor="#FF9D23" />
            <Spinner variant="dots" size="lg" label="Initializing" accentColor="#00ff41" />
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-primary mb-6">Pulse Variant</h2>
          <div className="grid grid-cols-3 gap-8">
            <Spinner variant="pulse" size="sm" label="Waiting" accentColor="#ff1493" />
            <Spinner variant="pulse" size="md" label="Syncing" accentColor="#00ff41" />
            <Spinner variant="pulse" size="lg" label="Connecting" accentColor="#03A6A1" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 25: Loading Progress Bar
// ============================================================================

import { LoadingProgress } from './LoadingProgress'
import { useState } from 'react'

export function LoadingProgressExample() {
  const [isLoading, setIsLoading] = useState(true)

  return (
    <div className="min-h-screen bg-background">
      <LoadingProgress
        isLoading={isLoading}
        position="top"
        accentColor="#FF9D23"
      />

      <div className="p-8 space-y-4">
        <h1 className="text-3xl font-bold text-primary mb-8">Loading Progress</h1>

        <button
          onClick={() => setIsLoading(!isLoading)}
          className="px-4 py-2 border border-primary text-primary rounded hover:bg-primary/10 transition-colors">
          {isLoading ? 'Stop' : 'Start'} Loading
        </button>

        <div className="p-4 border border-border rounded text-muted-foreground">
          Loading progress bar is shown at the top. Simulate a real operation by toggling the button.
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 26: Breadcrumb Navigation
// ============================================================================

import { Breadcrumb } from './Breadcrumb'

export function BreadcrumbExample() {
  return (
    <div className="min-h-screen bg-background p-8">
      <h1 className="text-3xl font-bold text-primary mb-8">Breadcrumb Navigation</h1>

      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold text-primary mb-3">Default</h2>
          <Breadcrumb
            items={[
              { label: 'Home', href: '/', icon: '🏠' },
              { label: 'Admin', href: '/admin', icon: '⚙' },
              { label: 'Settings', href: '/admin/settings', icon: '🔧' },
              { label: 'Users', icon: '👥' },
            ]}
            accentColor="#00ff41"
          />
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-3">Custom Separator</h2>
          <Breadcrumb
            items={[
              { label: 'Archive', icon: '📚' },
              { label: 'MAUK', icon: '🧠' },
              { label: 'Session 847', icon: '💬' },
            ]}
            separator="→"
            accentColor="#03A6A1"
          />
        </div>

        <div>
          <h2 className="text-lg font-bold text-primary mb-3">With Callbacks</h2>
          <Breadcrumb
            items={[
              { label: 'Dashboard', onClick: () => console.log('Dashboard') },
              { label: 'Projects', onClick: () => console.log('Projects') },
              { label: 'Current Project' },
            ]}
            separator="/"
            accentColor="#FF9D23"
          />
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Example 27: Badges and Tags
// ============================================================================

import { Badge, BadgeGroup } from './Badge'

export function BadgeExamples() {
  return (
    <div className="min-h-screen bg-background p-8 space-y-12">
      <h1 className="text-3xl font-bold text-primary mb-8">Badges & Tags</h1>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Variants</h2>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="default" color="success">Success</Badge>
            <Badge variant="default" color="warning">Warning</Badge>
            <Badge variant="default" color="error">Error</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Outline</Badge>
            <Badge variant="outline" color="info">Info</Badge>
            <Badge variant="outline" color="primary">Primary</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="solid">Solid</Badge>
            <Badge variant="solid" color="success">Success</Badge>
            <Badge variant="solid" color="warning">Warning</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="glow">Glow</Badge>
            <Badge variant="glow" color="info">Info Glow</Badge>
            <Badge variant="glow" color="#00ff41">Custom Glow</Badge>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Sizes</h2>
        <div className="flex flex-wrap gap-2">
          <Badge size="sm">Small</Badge>
          <Badge size="md">Medium</Badge>
          <Badge size="lg">Large</Badge>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">With Icons</h2>
        <div className="flex flex-wrap gap-2">
          <Badge icon="🧠">MAUK</Badge>
          <Badge icon="✨" color="warning">ABACI</Badge>
          <Badge icon="👤" color="primary">User</Badge>
          <Badge icon="⚙" color="info">System</Badge>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Removable Badges</h2>
        <BadgeGroup
          badges={[
            { label: 'Tag 1', icon: '#', removable: true, onRemove: () => console.log('Remove 1') },
            { label: 'Tag 2', icon: '#', removable: true, onRemove: () => console.log('Remove 2') },
            { label: 'Tag 3', icon: '#', removable: true, onRemove: () => console.log('Remove 3') },
          ]}
          variant="glow"
        />
      </div>

      <div>
        <h2 className="text-xl font-bold text-primary mb-4">Badge Group</h2>
        <BadgeGroup
          badges={[
            { label: 'React', icon: '⚛', color: 'info' },
            { label: 'TypeScript', icon: '📘', color: 'primary' },
            { label: 'Tailwind', icon: '🎨', color: 'success' },
            { label: 'Next.js', icon: '▲', color: 'warning' },
          ]}
          variant="solid"
          size="md"
        />
      </div>
    </div>
  )
}

// ============================================================================
// Export all examples
// ============================================================================

export const examples = {
  SimpleLLMBot,
  BrainVatAdminPanel,
  CustomThemeExamples,
  GameServerAdminPanel,
  MinimalExample,
  BrainVatAuditLog,
  APIAuditLog,
  ErrorAuditLog,
  AdminActionAuditLog,
  BrainVatMemoryArchive,
  MemoryCardExamples,
  AnimatedMemoryCards,
  ColoredMemoryCards,
  MinimalMemoryColumn,
  BotNameCardExample,
  SingleBotNameCard,
  BrainVatSchematicExample,
  CustomSchematicExample,
  BrainVatMissionExample,
  CustomMissionExample,
  DetailedMissionExample,
  AboutPageLayout,
  DialogueMessageExample,
  TimelineExample,
  HorizontalTimelineExample,
  AlertExamples,
  ProgressIndicatorExamples,
  StatsDisplayExample,
  CustomStatsExample,
  SpinnerExamples,
  LoadingProgressExample,
  BreadcrumbExample,
  BadgeExamples,
}
