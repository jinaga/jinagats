SELECT F3.HASH AS HASH3,
	F4.HASH AS HASH4,
	F6.HASH AS HASH6,
	sort(array[F3.FACT_ID, F4.FACT_ID, F6.FACT_ID], 'desc') as bookmark
FROM PUBLIC.FACT F1
JOIN PUBLIC.EDGE E1 ON E1.PREDECESSOR_FACT_ID = F1.FACT_ID
AND E1.ROLE_ID = 44
JOIN PUBLIC.FACT F3 ON F3.FACT_ID = E1.SUCCESSOR_FACT_ID
JOIN PUBLIC.EDGE E2 ON E2.PREDECESSOR_FACT_ID = F3.FACT_ID
AND e2.ROLE_ID = 46
JOIN PUBLIC.FACT F4 ON F4.FACT_ID = E2.SUCCESSOR_FACT_ID
JOIN PUBLIC.EDGE E4 ON E4.PREDECESSOR_FACT_ID = F4.FACT_ID
AND E4.ROLE_ID = 18
JOIN PUBLIC.FACT F6 ON F6.FACT_ID = E4.SUCCESSOR_FACT_ID
JOIN PUBLIC.EDGE E5 ON E5.SUCCESSOR_FACT_ID = F6.FACT_ID
AND E5.ROLE_ID = 23
JOIN PUBLIC.FACT F2 ON F2.FACT_ID = E5.PREDECESSOR_FACT_ID
WHERE F1.FACT_TYPE_ID = 35
	AND F1.HASH = '5kIRDvVO/wP4v7G9vhDAPMVi2q0cXsZtp9YuyAjan7yyDUhFFPiwwNnzTor6jFdkC11CYnDmoZueMAqxF9MPTQ=='
	AND F2.FACT_TYPE_ID = 24
	AND F2.HASH = '0WWlFbZH+gMoP3QGXO7/mf6hIQC/2iN7wd0peEQKFVvnJMp3gTVvi4eXfVd3DSa81MSzAVp7zVxXIiRnJTF0Kw=='
ORDER BY bookmark ASC