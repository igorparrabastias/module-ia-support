const { env } = require('./env')
/* eslint-disable no-useless-escape */
const { monotonicFactory } = require('ulid')
// Usar GoogleService.connectDatabase si usa secret
const knex = require('knex')(env.knexPg)
const categoriesIds = require('./categoriesIds')
const ulidFactory = monotonicFactory()

function ulid() {
  return ulidFactory()
}

const aUser1 = {
  id: 101,
  name: 'Issac Asimov',
  email: 'issac@xemail.com',
  photo: {
    ext: 'jpg',
    min: '748c8af5bde81a33ce8d4b251096ae33_200x200.jpg',
    size: 154995,
    md5name: '748c8af5bde81a33ce8d4b251096ae33'
  },
  uid: '0x0x0x0x0x0x0x0x0x0x0x0x0x0x0xx1',
  notification_token: '0x0x0x0x0x0x0x0x0x0x0x0x0x0x0xx1',
  options: {
    notifications: {
      enabled: true,
      intervalMinutes: 60
    }
  }
}
const aUser2 = {
  id: 102,
  name: 'Dennis Ritchie',
  email: 'dennis@xemail.com',
  photo: {
    ext: 'jpg',
    min: '748c8af5bde81a33ce8d4b251096ae33_200x200.jpg',
    size: 154995,
    md5name: '748c8af5bde81a33ce8d4b251096ae33'
  },
  uid: '0x0x0x0x0x0x0x0x0x0x0x0x0x0x0xx2',
  notification_token: '0x0x0x0x0x0x0x0x0x0x0x0x0x0x0xx2',
  options: {
    notifications: {
      enabled: true,
      intervalMinutes: 60
    }
  }
}

const inputPost = {
  entries: [
    {
      type: 'photo',
      data: {
        min: '28eb4f71286cfe58446d52451c369fba_130x130.jpg',
        med: '28eb4f71286cfe58446d52451c369fba_580x580.jpg',
        max: '28eb4f71286cfe58446d52451c369fba_1440x1440.jpg',
        md5name: '28eb4f71286cfe58446d52451c369fba',
        ext: 'jpg',
        nameOriginal: 'Zx-cpm.jpg',
        date: '2020-06-27 22:53:12',
        size: 26025
      }
    },
    {
      type: 'photo',
      data: {
        min: '83db2cb3196ba98dc82e4754a2cdb2e3_130x130.jpg',
        med: '83db2cb3196ba98dc82e4754a2cdb2e3_580x580.jpg',
        max: '83db2cb3196ba98dc82e4754a2cdb2e3_1440x1440.jpg',
        md5name: '83db2cb3196ba98dc82e4754a2cdb2e3',
        ext: 'jpg',
        nameOriginal: 'vaca-berta.jpg',
        date: '2020-06-29 18:41:42',
        size: 57613
      }
    }
  ],
  post: {
    body: 'Verbatim corrupti esse voluptates numquam natus eum error numquam voluptates numquam natus eum error numquam++.',
    location: {
      coords: '-33.459229,-70.645348',
      address: 'Los carrera 100, Concepcion',
      street: 'Los carrera 100',
      city: 'Santiago',
      commune: 'Santiago',
      mapName: 'sdsdsds-sdwewe-fgfgfgf-dfdfdgfg.pn'
    }
  },
  categories: ['incendio', 'destruccion']
}

module.exports.aUser1 = aUser1
module.exports.aUser2 = aUser2

module.exports.addUser = async (aUser) => {
  await knex('users').delete().where({ id: aUser.id })
  return knex('users')
    .insert(aUser)
    .returning('id')
    .then(() => console.warn('migrator: usuario agregado'))
    .catch((e) => {
      // Evita error entre test en paralelo
      if (e.message.indexOf('duplicate key ') === -1) {
        throw new Error(`migrator: usuario NO agregado: ${e.message}`)
      }
    })
}

module.exports.inputPost = inputPost

module.exports.truncate = async () => {
  const q =
    'TRUNCATE TABLE users, entry_likes, history, index, post_options, posts, posts_categories, user_entries, user_posts CASCADE'
  await knex.raw(q).then(() => console.warn('migrator: tablas truncadas'))
}

module.exports.addPostWithEntries = (deleted = false) => {
  const cid = ulid()
  const post = inputPost.post
  post.author_id = aUser1.id
  const entries = [
    {
      type: inputPost.entries[0].type,
      data: inputPost.entries[0].data,
      author_id: aUser1.id,
      parent_id: null,
      cid: cid
    }
  ]
  if (deleted) {
    post.deleted_at = '2020-07-18 15:12:34'
  }
  const categories = inputPost.categories.map((category) => ({
    category_id: categoriesIds[category],
    post_id: null
  }))

  return addPostWithEntries(post, entries, categories, cid).then((r) => {
    console.warn('migrator: post agregado')
    return r
  })

  function addPostWithEntries(post, entries, categories, cid) {
    let postId
    let entriesIds = []
    return knex.transaction(async (trx) => {
      return await trx
        .raw(
          `
    WITH cte_user_posts AS(
      INSERT INTO user_posts (
        author_id,
        cid,
        body,
        location
        )
      VALUES (
        :author_id,
        :cid,
        :body,
        :location
      )
      ON CONFLICT DO NOTHING
      RETURNING id
    )
    SELECT * FROM cte_user_posts
    UNION
      SELECT id FROM user_posts WHERE
      cid = :cid
     `,
          {
            author_id: post.author_id,
            cid: cid,
            body: post.body,
            location: post.location
          }
        )
        .then((r) => {
          postId = r.rows[0].id
          // Insertar sus entries
          entries.forEach((entry) => {
            entry.post_id = postId
          })
          return trx('user_entries').insert(entries, 'id')
        })
        .then((ids) => {
          entriesIds = ids
        })
        .then(() => {
          // Insertar sus categories
          categories.forEach((category) => {
            category.post_id = postId
          })
          return trx('posts_categories').insert(categories)
        })
        .then(() => {
          return { postId, entriesIds }
        })
    })
  }
}

module.exports.getPost = (postId) => {
  const sql = `
  SELECT
  user_posts.*,
  (CASE WHEN COUNT(user_entries) = 0 THEN NULL
    ELSE
      JSON_AGG(user_entries)
    END) AS entries
  FROM user_posts
  LEFT JOIN user_entries ON user_posts.id = user_entries.post_id
  WHERE user_posts.id = ?
  GROUP BY user_posts.id
  `
  return knex.raw(sql, [postId]).then((r) => {
    return r.rowCount ? r.rows[0] : null
  })
}

module.exports.addComment = (postId) => {
  const cid = ulid()
  const comment = [
    {
      type: 'comment',
      data: {
        body: 'Corrupti esse voluptates numquam natus eum error numquam malevolumn.'
      },
      author_id: aUser1.id,
      parent_id: null,
      post_id: postId,
      cid: cid
    }
  ]

  return addComment(comment).then((r) => {
    console.warn('migrator: comentario agregado')
    return r
  })

  async function addComment(entry) {
    let entryId = null
    const trx = await knex.transaction()
    try {
      await trx('user_entries')
        .insert(entry, 'id')
        .then((ids) => {
          entryId = ids
        })
        .then(trx.commit)
      return entryId
    } catch (error) {
      trx.rollback()
      throw error
    }
  }
}

module.exports.addPostWall = async (postId) => {
  const cid = ulid()
  const data = {
    post_id: postId,
    created_at: '2021-06-16T17:55:31.712Z',
    updated_at: null,
    post: `{"id": ${postId}, "body": "Verbatim corrupti esse voluptates numquam natus eum error numquam voluptates numquam natus eum error numquam++.", "location": {"city": "Santiago", "coords": "-33.459229,-70.645348", "street": "Los carrera 100", "address": "Los carrera 100, Concepcion", "commune": "Santiago", "mapName": "sdsdsds-sdwewe-fgfgfgf-dfdfdgfg.pn"}, "author_id": 100, "created_at": "2020-07-18T15:12:34.828Z", "deleted_at": null, "updated_at": null, "cid": "01EHB7P0SM3GR1ZCT1JVKC9Z39"}`,
    photos: `[{"id": 955, "data": {"date": "2019-01-19T20:00:08.978Z", "fileName": "https:\/\/source.unsplash.com\/CdK2eYhWfQ0\/640x480"}, "type": "photo", "post_id": ${postId}, "author_id": 100, "parent_id": null, "created_at": "2020-07-18T11:12:34.828115", "deleted_at": null, "updated_at": null}]`,
    comments: null,
    users: '[{"id": 100, "name": "Jaime Troncoso", "photo": "foto.jpg"}]',
    categories: '["incendio", "destruccion"]',
    qlikes: 0,
    cid: cid
  }
  await knex('posts')
    .insert(data)
    .then(() => {
      console.warn('migrator: post en wall:posts agregado')
    })

  const data2 = {
    post_id: postId,
    created_at: '2021-06-16T17:55:31.712Z',
    updated_at: null,
    post: `{"id": ${postId}, "cid": "01F8AZC2EPTCHH0WQPXQY59678", "body": "Because it doesn\'t have prepend slot. You can change icon with prepend-icon prop but not the color. You can go to Vuetify Github and make a feature request.\\n\\nIn the meanwhile, you can also use following little hack (works only because you using MDI icons with CSS/webfont)", "location": {"city": "Región Metropolitana", "coords": "-33.44275246799946,-70.68252651348877", "street": "Portales 3355", "address": "Portales 3355, Santiago, Región Metropolitana, Chile", "commune": "Santiago", "mapName": "5b5e1ebf-810c-46b1-8085-597c71272e02.png"}, "author_id": 22, "created_at": "2021-06-16T17:55:31.512Z", "deleted_at": null, "updated_at": null}`,
    photos: `[{"id": 269, "cid": null, "data": {"ext": "jpg", "max": "79789412a2dc6d55524fa8284fd8ec35_1440x1440.jpg", "med": "79789412a2dc6d55524fa8284fd8ec35_580x580.jpg", "min": "79789412a2dc6d55524fa8284fd8ec35_130x130.jpg", "date": "2021-06-15 08:12:35", "size": 120719, "md5name": "79789412a2dc6d55524fa8284fd8ec35", "nameOriginal": "6dc83476755a9c073f1339bb63a0f61c.jpg"}, "type": "photo", "post_id": ${postId}, "author_id": 22, "parent_id": null, "created_at": "2021-06-16T13:55:31.512535", "deleted_at": null, "updated_at": null}]`,
    users:
      '[{"id": 22, "name": "Distortion Dox 2", "photo": "748c8af5bde81a33ce8d4b251096ae33_200x200.jpg"}]',
    categories: '["saqueo"]',
    qlikes: 0,
    qcomments: 2
  }

  return knex('index')
    .insert(data2)
    .then(() => {
      console.warn('migrator: post en wall:index agregado')
    })
}
