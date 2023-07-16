 prisma.model.create({
     data: {
         // equivalent to DbNull
         jsonColumn: null
     }
 })
    prisma.model.create({
    data: {
        // equivalent to JsonNull
        jsonColumn: null
    }
})

prisma.model.create({
    where:{ id: 1 },
    data: {
        // single JSON array in a list
        jsonList: { key: 'value' }
    }
})

prisma.model.create({
    data: {
        // 3 json strings in a list
        jsonList: ['a', 'b', 'c']
    }
})

prisma.model.findMany({
    data: {
        jsonColumn: {
            // some future prisma API that might conflict with JSON
            equals:  'someDbFunction()'
        }
    }
})

prisma.model.findMany({
    data: {
        jsonColumn: {
            // json value that just happen to have the same form as our future API
            equals:  'someDbFunction()'
        }
    }
})
