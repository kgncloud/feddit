module.exports = function(request, fs) {
  const config = require('../config')
  this.downloadFile = (url) => {
    return new Promise(resolve => {
      request(url, { encoding: 'binary' }, (error, response, body) => {
        if(!error && response.statusCode === 200) {
          resolve({ success: true, data: body })
        } else {
          resolve({ success: false, data: null })
        }
      })
    }).catch((err) => {
      console.log(`Downloading media file failed for unknown reason. Details:`, err)
    })
  }

  this.writeToDisk = (data, filename) => {
    return new Promise(resolve => {
      fs.writeFile(filename, data, 'binary', (error, result) => {
        if(!error) {
          resolve({ success: true })
        } else {
          resolve({ success: false, error })
        }
      })
    }).catch((err) => {
      console.log(`Writing media file to disk failed for unknown reason. Details:`, err)
    })
  }

  this.logTimestamp = (date) => {
    return date.toGMTString()
  }

  this.cleanUrl = (url) => {
    return url.replace(/&amp;/g, '&')
  }

  this.teddifyUrl = (url, user_preferences) => {
    try {
      let u = new URL(url)
      let domain_replaced = false
      if(u.host === 'www.reddit.com' || u.host === 'reddit.com') {
        url = url.replace(u.host, config.domain)
        domain_replaced = true
        if(u.pathname.startsWith('/gallery/'))
          url = url.replace('/gallery/', '/comments/')
      }
      if(u.host === 'i.redd.it' || u.host === 'v.redd.it') {
        let image_exts = ['png', 'jpg', 'jpeg']
        let video_exts = ['mp4', 'gif', 'gifv']
        let file_ext = getFileExtension(url)
        if(image_exts.includes(file_ext))
          url = url.replace(`${u.host}/`, `${config.domain}/pics/w:null_`)
          domain_replaced = true
        if(video_exts.includes(file_ext) || !image_exts.includes(file_ext))
          url = url.replace(u.host, `${config.domain}/vids`) + '.mp4'
          domain_replaced = true
      }

      if(domain_replaced && !config.https_enabled) {
        url = url.replace('https:', 'http:')
      }
    } catch(e) { }
    url = replaceDomains(url, user_preferences)
    return url
  }

  this.kFormatter = (num) => {
      return Math.abs(num) > 999 ? Math.sign(num)*((Math.abs(num)/1000).toFixed(1)) + 'k' : Math.sign(num)*Math.abs(num)
  }

  this.timeDifference = (time, hide_suffix) => {
    time = parseInt(time) * 1000
    let ms_per_minute = 60 * 1000
    let ms_per_hour = ms_per_minute * 60
    let ms_per_day = ms_per_hour * 24
    let ms_per_month = ms_per_day * 30
    let ms_per_year = ms_per_day * 365
    let current = + new Date()
    let suffix = 'ago'
    
    if(hide_suffix)
      suffix = ''

    let elapsed = Math.abs(time - current)
    let r = ''
    let e

    if(elapsed < ms_per_minute) {
      e = Math.round(elapsed/1000)
      r = `${e} seconds ${suffix}`
      if(e === 1)
        r = 'just now'
      return r
    }

    else if(elapsed < ms_per_hour) {
      e = Math.round(elapsed/ms_per_minute)
      r = `${e} minutes ${suffix}`
      if(r === 1)
        r = `a minute ${suffix}`
      return r
    }

    else if(elapsed < ms_per_day ) {
      e = Math.round(elapsed/ms_per_hour)
      r = `${e} hours ${suffix}`
      if(e === 1)
        r = `an hour ${suffix}`
      return r
    }

    else if(elapsed < ms_per_month) {
      e = Math.round(elapsed/ms_per_day)
      r = `${e} days ${suffix}`
      if(e === 1)
        r = `1 day ${suffix}`
      return r
    }

    else if(elapsed < ms_per_year) {
      e = Math.round(elapsed/ms_per_month)
      r = `${e} months ${suffix}`
      if(e === 1)
        r = `1 month ${suffix}`
      return r
    }

    else {
      e = Math.round(elapsed/ms_per_year)
      r = `${e} years ${suffix}`
      if(e === 1)
        r = `1 year ${suffix}`
      return r
    }
  }

  this.toUTCString = (time) => {
    let d = new Date()
    d.setTime(time*1000)
    return d.toUTCString()
  }

  

  this.unescape = (s, user_preferences) => {
    /* It would make much more sense to rename this function to something
    * like "formatter".
    */
    if(s) {
      var re = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;
      var unescaped = {
        '&amp;': '&',
        '&#38;': '&',
        '&lt;': '<',
        '&#60;': '<',
        '&gt;': '>',
        '&#62;': '>',
        '&apos;': "'",
        '&#39;': "'",
        '&quot;': '"',
        '&#34;': '"'
      }
      let result = s.replace(re, (m) => {
        return unescaped[m]
      })
      
      result = replaceDomains(result, user_preferences)
      
      return result
    } else {
      return ''
    }
  }

  this.replaceDomains = (str, user_preferences) => {
    if(typeof(str) == 'undefined' || !str)
      return

    if (config.domain_replacements) {
      for (replacement of config.domain_replacements) {
        str = str.replace(...replacement)
      }
    }

    return this.replaceUserDomains(str, user_preferences)
  }

  this.replaceUserDomains = (str, user_preferences) => {
    
    let redditRegex = /(?<=href=")(https?:\/\/)([A-z.]+\.)?(reddit(\.com)|redd(\.it))(?=.+")/gm;
    let youtubeRegex = /(?<=href=")(https?:\/\/)([A-z.]+\.)?youtu(be\.com|\.be)(?=.+")/gm;
    let twitterRegex = /(?<=href=")(https?:\/\/)(www\.)?twitter\.com(?=.+")/gm;
    let instagramRegex = /(?<=href=")(https?:\/\/)(www+\.)?instagram.com(?=.+")/gm;

    let protocol = config.https_enabled || config.api_force_https ? 'https://' : 'http://'

    /**
     * Special handling for reddit media domains in comments hrefs.
     * For example a comment might have a direct links to images in i.redd.it:
     * <a href="https://i.redd.it/hly9gyg9gjh81.png">Just refer to this </a>
     * We want to rewrite these hrefs, but we also need to include the media
     * for our backend, so we know where to fetch the media from.
     * That comment URL then becomes like this after rewriting, for example:
     * <a href="https://teddit.net/hly9gyg9gjh81.png?teddit_proxy=i.redd.it">Just refer to this </a>
     * And then in our backend, we check if we have a 'teddit_proxy' in the req
     * query, and proceed to proxy if it does.
     */
    const replacable_media_domains = ['i.redd.it', 'v.redd.it', 'preview.redd.it']
    replacable_media_domains.forEach((domain) => {
      if (str.includes(domain + "/")) {
        const href_regex = new RegExp(`(?<=href=")(https?:\/\/)([A-z.]+\.)?(${domain})(.+?(?="))`, 'gm')
        const hrefs = str.match(href_regex)
        if (!hrefs) {
          return
        }

        hrefs.forEach((url) => {
          let original_url = url
          const valid_exts = ['png', 'jpg', 'jpeg', 'mp4', 'gif', 'gifv']
          const file_ext = getFileExtension(url)
          if (valid_exts.includes(file_ext)) {
            url = url.replace(domain, config.domain)

            // append the domain info to the query, for teddit backend
            let u = new URL(url)
            if (u.query) {
              url += '&teddit_proxy=' + domain
            } else {
              url += '?teddit_proxy=' + domain
            }

            // also replace the protocol for instances using http only
            if (protocol === 'http://' && u.protocol === 'https:') {
              url.replace('https://', protocol)
            }
            str = str.replace(original_url, url)
          }
        })
      }
    })

    // Continue the normal replace logic

    str = str.replace(redditRegex, protocol + config.domain)
    
    if(typeof(user_preferences) == 'undefined')
      return str
    
    if(typeof(user_preferences.domain_youtube) != 'undefined')
      if(user_preferences.domain_youtube)
        str = str.replace(youtubeRegex, protocol + user_preferences.domain_youtube)
    
    if(typeof(user_preferences.domain_twitter) != 'undefined')
      if(user_preferences.domain_twitter)
        str = str.replace(twitterRegex, protocol + user_preferences.domain_twitter)
    
    if(typeof(user_preferences.domain_instagram) != 'undefined')
      if(user_preferences.domain_instagram)
        str = str.replace(instagramRegex, protocol + user_preferences.domain_instagram)
    
    return str
  }

  this.deleteFiles = (files, callback) => {
    var i = files.length
    files.forEach((filepath) => {
      fs.unlink(filepath, (err) => {
        i--
        if(err) {
          callback(err)
          return
        } else if(i <= 0) {
          callback(null)
        }
      })
    })
  }

  this.isGif = (url) => {
    if(url.startsWith('/r/'))
      return false
    
    try {
      url = new URL(url)
      let pathname = url.pathname
      let file_ext = pathname.substring(pathname.lastIndexOf('.') + 1)
      if(file_ext === 'gif' || file_ext === 'gifv') {
        return true
      } else {
        return false
      }
    } catch (error) {
      console.error(`Invalid url supplied to isGif(). URL: ${url}`, error)
      return false
    }
  }

  this.getFileExtension = (url) => {
    try {
      url = new URL(url)
      let pathname = url.pathname
      let file_ext = pathname.substring(pathname.lastIndexOf('.') + 1)
      if(file_ext) {
        return file_ext
      } else {
        return ''
      }
    } catch (error) {
      console.error(`Invalid url supplied to getFileExtension(). URL: ${url}`, error)
      return ''
    }
  }

  this.formatLinkFlair = async (post) => {
    if (!config.flairs_enabled) {
      return ''
    }

    const wrap = (inner) => `<span class="flair">${inner}</span>`

    if (post.link_flair_text === null)
      return ''

    if (post.link_flair_type === 'text')
      return wrap(post.link_flair_text)

    if (post.link_flair_type === 'richtext') {
      let flair = ''
      for (let fragment of post.link_flair_richtext) {
        if (fragment.e === 'text')
          flair += fragment.t
        else if (fragment.e === 'emoji')
          flair += `<span class="emoji" style="background-image: url(${await downloadAndSave(fragment.u, 'flair_')})"></span>`
        }
      return wrap(flair)
    }

    return ''
  }

  this.formatUserFlair = async (post) => {
    if (!config.flairs_enabled) {
      return ''
    }

    // Generate the entire HTML here for consistency in both pug and HTML
    const wrap = (inner) => `<span class="flair">${inner}</span>`

    if (post.author_flair_text === null)
      return ''

    if (post.author_flair_type === 'text')
      return wrap(post.author_flair_text)

    if (post.author_flair_type === 'richtext') {
      let flair = ''
      for (let fragment of post.author_flair_richtext) {
        // `e` seems to mean `type`
        if (fragment.e === 'text')
          flair += fragment.t // `t` is the text
        else if (fragment.e === 'emoji')
          flair += `<span class="emoji" style="background-image: url(${await downloadAndSave(fragment.u, 'flair_')})"></span>` // `u` is the emoji URL
        }
      return wrap(flair)
    }

    return ''
  }

}
