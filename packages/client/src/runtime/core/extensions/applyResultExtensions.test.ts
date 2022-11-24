import { applyResultExtensions } from './applyResultExtensions'

test('does not add fields if some dependencies are not met', () => {
  const result = {
    firstName: 'John',
  }

  const fullName = jest.fn()
  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute: fullName,
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(fullName).not.toBeCalled()
  expect(extended).not.toHaveProperty('fullName')
})

test('adds a field if all dependencies are met', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('fullName', 'John Smith')
})

test('does not add a field if it is not present in select', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({
    result,
    modelName: 'user',
    select: { firstName: true, lastName: true },
    extensions: [extension],
  })
  expect(extended).not.toHaveProperty('fullName')
})

test('adds a field if it is present in select', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({
    result,
    modelName: 'user',
    select: { firstName: true, lastName: true, fullName: true },
    extensions: [extension],
  })
  expect(extended).toHaveProperty('fullName', 'John Smith')
  expect(extended).toHaveProperty('firstName')
  expect(extended).toHaveProperty('lastName')
})

test('masks dependencies if they are not present in select', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({
    result,
    modelName: 'user',
    select: { fullName: true },
    extensions: [extension],
  })
  expect(extended).toHaveProperty('fullName', 'John Smith')
  expect(extended).not.toHaveProperty('firstName')
  expect(extended).not.toHaveProperty('lastName')
})

test('counts falsy values as met dependencies', () => {
  const result = {
    firstName: 'John',
    lastName: '',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('fullName', 'John ')
})

test('can add multiple fields', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
        loudName: {
          needs: { firstName: true },
          compute(user) {
            return `${user.firstName.toUpperCase()}!`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('fullName', 'John Smith')
  expect(extended).toHaveProperty('loudName', 'JOHN!')
})

test('allows fields to use other fields', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extA = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extB = {
    result: {
      user: {
        loudFullName: {
          needs: { fullName: true },
          compute(user) {
            return user.fullName.toUpperCase()
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extA, extB] })
  expect(extended).toHaveProperty('loudFullName', 'JOHN SMITH')
})

test('does not add a field if model does not match', () => {
  const result = {
    firstName: 'John',
    lastName: 'Smith',
  }

  const extension = {
    result: {
      user: {
        fullName: {
          needs: { firstName: true, lastName: true },
          compute(user) {
            return `${user.firstName} ${user.lastName}`
          },
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'post', extensions: [extension] })
  expect(extended).not.toHaveProperty('fullName')
})

test('adds a field if it is specified in $allModels', () => {
  const result = {}

  const extension = {
    result: {
      $allModels: {
        computedField: {
          compute: () => 1,
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('computedField', 1)
})

test('specific model field takes precedence over $allModels', () => {
  const result = {}

  const extension = {
    result: {
      $allModels: {
        computedField: {
          compute: () => 'original',
        },
      },

      user: {
        computedField: {
          needs: {},
          compute: () => 'override',
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('computedField', 'override')
})

test('non-conflicting fields from $allModels and specific model co-exist', () => {
  const result = {}

  const extension = {
    result: {
      $allModels: {
        allModelsField: {
          needs: {},
          compute: () => 'all',
        },
      },

      user: {
        userModelField: {
          needs: {},
          compute: () => 'user',
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  expect(extended).toHaveProperty('allModelsField', 'all')
  expect(extended).toHaveProperty('userModelField', 'user')
})

test('caches the result', () => {
  const result = {
    firstName: 'John',
  }

  const compute = jest.fn()

  const extension = {
    result: {
      user: {
        computed: {
          needs: { firstName: true },
          compute,
        },
      },
    },
  }

  const extended = applyResultExtensions({ result, modelName: 'user', extensions: [extension] })
  extended['computed']
  extended['computed']

  expect(compute).toHaveBeenCalledTimes(1)
})
