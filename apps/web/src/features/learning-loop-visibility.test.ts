import { describe, expect, it } from 'vitest'
import {
  decisionRecorderControlsDisabled,
  hypothesisLabAdminActionsVisible,
  shouldShowHypothesisLabOnTradingLab,
  shouldShowLearningLoopOnIa,
  shouldShowPostMortemRunButton,
} from './learning-loop-visibility'

describe('shouldShowLearningLoopOnIa', () => {
  it('returns false when the Learning Loop UI flag is off, regardless of advisor/mode', () => {
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: false,
        aiAdvisorVisible: true,
        mode: 'admin',
      })
    ).toBe(false)
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: false,
        aiAdvisorVisible: true,
        mode: 'demo',
      })
    ).toBe(false)
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: false,
        aiAdvisorVisible: false,
        mode: 'admin',
      })
    ).toBe(false)
  })

  it('returns false when the AI Advisor is not visible', () => {
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: true,
        aiAdvisorVisible: false,
        mode: 'admin',
      })
    ).toBe(false)
  })

  it('returns false while the auth mode is still pending (undefined)', () => {
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: true,
        aiAdvisorVisible: true,
        mode: undefined,
      })
    ).toBe(false)
  })

  it('returns true only when flag is on, advisor is visible, and a mode is resolved', () => {
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: true,
        aiAdvisorVisible: true,
        mode: 'admin',
      })
    ).toBe(true)
    expect(
      shouldShowLearningLoopOnIa({
        learningLoopFlag: true,
        aiAdvisorVisible: true,
        mode: 'demo',
      })
    ).toBe(true)
  })
})

describe('shouldShowHypothesisLabOnTradingLab', () => {
  it('hides the section when the flag is off', () => {
    expect(
      shouldShowHypothesisLabOnTradingLab({ learningLoopFlag: false, mode: 'admin' })
    ).toBe(false)
    expect(
      shouldShowHypothesisLabOnTradingLab({ learningLoopFlag: false, mode: 'demo' })
    ).toBe(false)
  })

  it('hides the section while the auth mode is pending', () => {
    expect(
      shouldShowHypothesisLabOnTradingLab({ learningLoopFlag: true, mode: undefined })
    ).toBe(false)
  })

  it('shows the section in admin or demo when the flag is on', () => {
    expect(
      shouldShowHypothesisLabOnTradingLab({ learningLoopFlag: true, mode: 'admin' })
    ).toBe(true)
    expect(
      shouldShowHypothesisLabOnTradingLab({ learningLoopFlag: true, mode: 'demo' })
    ).toBe(true)
  })
})

describe('shouldShowPostMortemRunButton', () => {
  it('hides the run button in demo mode regardless of flag', () => {
    expect(
      shouldShowPostMortemRunButton({ learningLoopFlag: true, mode: 'demo' })
    ).toBe(false)
    expect(
      shouldShowPostMortemRunButton({ learningLoopFlag: false, mode: 'demo' })
    ).toBe(false)
  })

  it('hides the run button when the flag is off in admin', () => {
    expect(
      shouldShowPostMortemRunButton({ learningLoopFlag: false, mode: 'admin' })
    ).toBe(false)
  })

  it('hides the run button while auth mode is pending', () => {
    expect(
      shouldShowPostMortemRunButton({ learningLoopFlag: true, mode: undefined })
    ).toBe(false)
  })

  it('shows the run button only when admin AND flag is on', () => {
    expect(
      shouldShowPostMortemRunButton({ learningLoopFlag: true, mode: 'admin' })
    ).toBe(true)
  })
})

describe('decisionRecorderControlsDisabled', () => {
  it('disables controls in demo mode', () => {
    expect(decisionRecorderControlsDisabled({ mode: 'demo' })).toBe(true)
  })

  it('disables controls while auth mode is pending', () => {
    expect(decisionRecorderControlsDisabled({ mode: undefined })).toBe(true)
  })

  it('enables controls only in admin mode', () => {
    expect(decisionRecorderControlsDisabled({ mode: 'admin' })).toBe(false)
  })
})

describe('hypothesisLabAdminActionsVisible', () => {
  it('hides admin actions in demo or while auth mode is pending', () => {
    expect(hypothesisLabAdminActionsVisible({ mode: 'demo' })).toBe(false)
    expect(hypothesisLabAdminActionsVisible({ mode: undefined })).toBe(false)
  })

  it('shows admin actions only in admin mode', () => {
    expect(hypothesisLabAdminActionsVisible({ mode: 'admin' })).toBe(true)
  })
})
