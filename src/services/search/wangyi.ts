import got from 'got'
import { removePunctuation, joinSingersName, encryptParams } from '../../utils'
import type { SearchSongInfo, SearchProps } from '../../types'

export default async ({ text, pageNum, pageSize, songListId }: SearchProps) => {
  let searchSongs: SearchSongInfo[], totalSongCount
  if (songListId) {
    const songListSearchUrl = `https://music.163.com/api/v3/playlist/detail?id=${songListId}`
    const { playlist } = await got(songListSearchUrl).json()
    const searchSongsIds =
      playlist?.trackIds.slice(
        (Number(pageNum) - 1) * Number(pageSize),
        Number(pageNum) * Number(pageSize)
      ) || []
    const ids = searchSongsIds.map(({ id }: { id: string }) => id)
    const { songs } = await got('https://music.163.com/weapi/v3/song/detail', {
      method: 'post',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36',
        origin: 'https://music.163.com',
      },
      form: encryptParams({
        c: '[' + ids.map((id: string) => '{"id":' + id + '}').join(',') + ']',
        ids: '[' + ids.join(',') + ']',
      }),
    }).json()
    searchSongs = songs
    totalSongCount = playlist?.trackIds?.length || undefined
  } else {
    const normalSearchUrl = `https://music.163.com/api/search/get/web?s=${encodeURIComponent(
      text
    )}&type=1&limit=${pageSize}&offset=${(Number(pageNum) - 1) * 20}`
    const {
      result: { songs = [], songCount },
    } = await got(normalSearchUrl).json()
    searchSongs = songs
    totalSongCount = songCount
  }
  const detailResults = await Promise.all(
    searchSongs.map(({ id }) => {
      const detailUrl = `https://music.163.com/api/song/enhance/player/url/v1?id=${id}&ids=[${id}]&level=standard&encodeType=mp3`
      return got(detailUrl).json()
    })
  )
  searchSongs.map((item: SearchSongInfo, index: number) => {
    const { data }: any = detailResults[index]
    const { id, url, size } = data[0]
    Object.assign(item, {
      url,
      size,
      disabled: !size,
      songName: `${removePunctuation(
        joinSingersName(songListId ? item.ar : item.artists)
      )} - ${removePunctuation(item.name)}.mp3`,
      lyricUrl: `https://music.163.com/api/song/lyric?id=${id}&lv=1`,
    })
  })
  return {
    searchSongs,
    totalSongCount,
  }
}
