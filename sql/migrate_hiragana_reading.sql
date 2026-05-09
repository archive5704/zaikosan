-- 既存データの読みを「ひらがな読み」に直すための任意SQLです。
-- 自分で追加した食材は、アプリ画面から読みを手動で修正してください。

update public.items set reading = 'ふじもとしょうゆ' where name = 'ふじもと醤油';
update public.items set reading = 'じゅんまいちょうりしゅ' where name = '純米調理酒';
update public.items set reading = 'おりーぶゆ' where name = 'オリーブ油';
update public.items set reading = 'つぶますたーど' where name = 'つぶマスタード';
update public.items set reading = 'ますたーど' where name = 'マスタード';
update public.items set reading = 'はくりきこ' where name = '薄力粉';
update public.items set reading = 'かたくりこ' where name = '片栗粉';
update public.items set reading = 'にんじん' where name = 'にんじん';
update public.items set reading = 'たまねぎ' where name = '玉ねぎ';
update public.items set reading = 'くろこしょう' where name = '黒こしょう';
update public.items set reading = 'こんぶ' where name = '昆布';
