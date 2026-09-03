import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  getFieldError,
  setFieldError,
  validateRegisterForm,
} from './solution.js'
import type {
  RegisterMethod,
  Address,
  EmailRegisterForm,
  PhoneRegisterForm,
  RegisterForm,
  FieldErrors,
  FormState,
} from './solution.js'

// =============================================================
// 测试数据(顶层只做类型标注,不调用任何待实现函数)
// =============================================================

const address: Address = { country: '中国', city: '上海' }

const emailForm: EmailRegisterForm = {
  method: 'email',
  username: 'hf',
  password: '12345678',
  email: 'hf@example.com',
  emailCode: '123456',
  address,
}

const phoneForm: PhoneRegisterForm = {
  method: 'phone',
  username: 'hf',
  password: '12345678',
  phone: '13800000000',
  smsCode: '654321',
  address,
}

const emptyState: FormState<EmailRegisterForm> = {
  values: emailForm,
  errors: {},
  touched: { username: true },
  submitCount: 0,
}

// =============================================================
// Part 1 — 条件字段 + 嵌套字段
// =============================================================

describe('Day 9 — Part 1 类型定义', () => {
  it('RegisterMethod 必须是两个字面量', () => {
    expectTypeOf<RegisterMethod>().toEqualTypeOf<'email' | 'phone'>()
  })

  it('Address 形状正确,可选字段不带 | undefined', () => {
    expectTypeOf<Address>().toEqualTypeOf<{
      country: string
      city: string
      detail?: string
      zip?: string
    }>()
  })

  it('RegisterForm 是两种表单的联合', () => {
    expectTypeOf<RegisterForm>().toEqualTypeOf<
      EmailRegisterForm | PhoneRegisterForm
    >()
  })

  it('method 判别后类型收窄(phone 分支)', () => {
    const f: RegisterForm = phoneForm
    if (f.method === 'phone') {
      expectTypeOf(f).toEqualTypeOf<PhoneRegisterForm>()
      expect(f.smsCode).toBe('654321')
    }
  })

  it('method 判别后类型收窄(email 分支)', () => {
    const f: RegisterForm = emailForm
    if (f.method === 'email') {
      expectTypeOf(f).toEqualTypeOf<EmailRegisterForm>()
      expect(f.email).toBe('hf@example.com')
    }
  })

  it('条件字段:选 email 就不能出现手机字段', () => {
    // @ts-expect-error —— EmailRegisterForm 没有 phone 字段(excess property check)
    const bad: RegisterForm = { method: 'email', username: 'u', password: 'p1234567', email: 'a@b.c', emailCode: '123456', address, phone: '13800000000' }
    void bad
  })

  it('条件字段:选 phone 缺 smsCode 必须编译报错', () => {
    // @ts-expect-error —— PhoneRegisterForm 必填 smsCode,缺失即报错
    const bad: RegisterForm = { method: 'phone', username: 'u', password: 'p1234567', phone: '13800000000', address }
    void bad
  })

  it('exactOptionalPropertyTypes:可选字段不能显式传 undefined', () => {
    // @ts-expect-error —— detail?: string 只允许"不存在",不允许显式 undefined
    const bad: Address = { country: '中国', city: '上海', detail: undefined }
    void bad
  })
})

// =============================================================
// Part 2 — 校验状态(errors / touched)
// =============================================================

describe('Day 9 — Part 2 FieldErrors / getFieldError', () => {
  it('FieldErrors<T> 键受限、值可为空', () => {
    expectTypeOf<FieldErrors<EmailRegisterForm>>().toEqualTypeOf<
      Partial<
        Record<
          'method' | 'username' | 'password' | 'email' | 'emailCode' | 'address',
          string
        >
      >
    >()
  })

  it('getFieldError:取到错误信息 / 没有错误返回 undefined', () => {
    const errors: FieldErrors<EmailRegisterForm> = { email: '邮箱格式不正确' }
    expect(getFieldError(errors, 'email')).toBe('邮箱格式不正确')
    expect(getFieldError(errors, 'username')).toBeUndefined()
    expectTypeOf(getFieldError(errors, 'email')).toEqualTypeOf<
      string | undefined
    >()
  })

  it('getFieldError:字段名必须在 keyof T 内', () => {
    const errors: FieldErrors<EmailRegisterForm> = {}
    // @ts-expect-error —— 'foo' 不是 EmailRegisterForm 的字段
    getFieldError(errors, 'foo')
  })
})

describe('Day 9 — Part 2 setFieldError(不可变更新)', () => {
  it('返回新 state,原对象不被修改', () => {
    const next = setFieldError(emptyState, 'email', '邮箱格式不正确')
    expect(next.errors).toEqual({ email: '邮箱格式不正确' })
    expect(emptyState.errors).toEqual({}) // 不可变:原对象还是空
    expect(next.values).toBe(emailForm) // values 引用原样透传
    expect(next.touched).toEqual({ username: true })
    expect(next.submitCount).toBe(0)
    expectTypeOf(next).toEqualTypeOf<FormState<EmailRegisterForm>>()
  })

  it('字段名必须在 keyof T 内', () => {
    // @ts-expect-error —— 'foo' 不是 EmailRegisterForm 的字段
    setFieldError(emptyState, 'foo', '随便什么')
  })
})

// =============================================================
// Part 3 — validateRegisterForm(签名从测试反推)
// =============================================================

describe('Day 9 — Part 3 validateRegisterForm', () => {
  it('返回类型必须跟着入参收窄(反推泛型签名)', () => {
    const errs = validateRegisterForm(emailForm)
    expectTypeOf(errs).toEqualTypeOf<FieldErrors<EmailRegisterForm>>()
    expectTypeOf(validateRegisterForm(phoneForm)).toEqualTypeOf<
      FieldErrors<PhoneRegisterForm>
    >()
  })

  it('合法表单返回空对象', () => {
    expect(validateRegisterForm(emailForm)).toEqual({})
    expect(validateRegisterForm(phoneForm)).toEqual({})
  })

  it('公共校验:用户名空 / 密码过短', () => {
    const errs = validateRegisterForm({ ...emailForm, username: '  ', password: '123' })
    expect(errs).toEqual({ username: '用户名必填', password: '密码至少 8 位' })
  })

  it('email 分支:邮箱格式 + 验证码位数', () => {
    const errs = validateRegisterForm({ ...emailForm, email: 'not-an-email', emailCode: '12' })
    expect(errs).toEqual({ email: '邮箱格式不正确', emailCode: '验证码必须是 6 位' })
  })

  it('phone 分支:手机号位数 + 验证码位数', () => {
    const errs = validateRegisterForm({ ...phoneForm, phone: '1380000000', smsCode: '1' })
    expect(errs).toEqual({ phone: '手机号必须是 11 位', smsCode: '验证码必须是 6 位' })
  })

  it('返回的 errors 可以直接喂给 getFieldError', () => {
    const errs = validateRegisterForm({ ...emailForm, email: 'bad' })
    expect(getFieldError(errs, 'email')).toBe('邮箱格式不正确')
  })
})
