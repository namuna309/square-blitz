// App.js
import React, { useEffect, useState, useRef } from 'react';

function App() {
  const [showButton, setShowButton] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [showGo, setShowGo] = useState(false);
  const [squares, setSquares] = useState([]);  // {id, x, y, bursting: boolean}
  const [clickedCount, setClickedCount] = useState(0);
  const [gameOver, setGameOver] = useState(false); 
  const [allSpawned, setAllSpawned] = useState(false);
  const [showRetry, setShowRetry] = useState(false);
  const SQUARE_SIZE = 40;
  const TOTAL_SQUARES = 50;

  // 난이도(전단계에서 설정한 값 사용)
  // 스폰 간격
  const INITIAL_DELAY = 2000;
  const MID_DELAY = 900;      
  const PHASE1_DECREMENT = (INITIAL_DELAY - MID_DELAY) / (10 - 1); // (2000-900)/9 ≈ 122.22ms
  const PHASE2_START_DELAY = 1000;
  const LOWER_DELAY = 400; 
  const PHASE2_DECREMENT = (PHASE2_START_DELAY - LOWER_DELAY) / (25 - 10); // (1000-400)/15=40ms
  const FINAL_DELAY = 400; 

  // 박스 제거 시간
  const REMOVE_START_PHASE1 = 7.0;
  const REMOVE_END_PHASE1 = 4.5;
  const REMOVE_PHASE1_DEC = (REMOVE_START_PHASE1 - REMOVE_END_PHASE1) / (10 - 1); // (7-4.5)/9≈0.2777초
  const REMOVE_START_PHASE2 = 5.0;
  const REMOVE_END_PHASE2 = 2.5;
  const REMOVE_PHASE2_DEC = (REMOVE_START_PHASE2 - REMOVE_END_PHASE2) / (25 - 10); // (5-2.5)/15≈0.1667초
  const REMOVE_PHASE3 = 2.5;

  const timersRef = useRef({});

  const getUserId = () => {
    let userId = localStorage.getItem('userId');
    
    if (!userId) {
      // userId가 없으면 새로 생성
      userId = Date.now() + Math.floor(Math.random() * 1_000_000); // 간단한 ID 생성 예
      localStorage.setItem('userId', userId);
    }
    
    return userId;
  };

  // ID를 가져옴
  const userId = getUserId();
  const EC2_PUBLIC_ENDPOINT = process.env.REACT_APP_EC2_PUBLIC_ENDPOINT;
  const EC2_PORT = process.env.REACT_APP_EC2_PORT;

  const logEvent = async (event, details) => {
    const log = {
      userId: userId,
      timestamp: new Date().toISOString(),
      event,
      details,
    };
  
    // 서버로 로그 전송 (server.js와 연계)
    await fetch(`${EC2_PUBLIC_ENDPOINT}:${EC2_PORT}/api/log-game-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  };
  const handleStart = () => {
    logEvent('game_start', { clickedAt: Date.now() });
    setFadeOut(true);
  };

  useEffect(() => {
    if (fadeOut) {
      const timer = setTimeout(() => {
        setShowButton(false);
        setCountdown(3);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fadeOut]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const interval = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (countdown === 0) {
      setShowGo(true);
    }
  }, [countdown]);

  useEffect(() => {
    if (showGo) {
      const startTimer = setTimeout(() => {
        setShowGo(false); 
        spawnBoxes(1, INITIAL_DELAY);
      }, 1000); 
      return () => clearTimeout(startTimer);
    }
  }, [showGo]);

  // 마지막 박스 사라진 후 게임 종료 처리
  useEffect(() => {
    if (allSpawned && squares.length === 0 && !gameOver) {
      // 마지막 박스 사라진 후 1초 뒤 "게임 종료!" 표시
      const endTimer = setTimeout(() => {
        setGameOver(true);
      }, 1000);
      return () => clearTimeout(endTimer);
    }
  }, [allSpawned, squares, gameOver]);

  // 게임 종료 시 결과 LOG 처리
  useEffect(() => {
    if (gameOver) {
      const gameData = {
        userId: userId,
        timestamp: new Date().toISOString(),
        totalSquares: TOTAL_SQUARES,
        clickedCount: clickedCount,
        successRate: (clickedCount / TOTAL_SQUARES) * 100,
      };
  
      fetch(`${EC2_PUBLIC_ENDPOINT}:${EC2_PORT}/api/log-game-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gameData),
      });
    }
  }, [gameOver]);

  // 게임 종료 후 1초 뒤 Retry 버튼 표시
  useEffect(() => {
    if (gameOver && !showRetry) {
      const retryTimer = setTimeout(() => {
        setShowRetry(true);
      }, 1000);
      return () => clearTimeout(retryTimer);
    }
  }, [gameOver, showRetry]);

  const getNonOverlappingPosition = (existingSquares, maxAttempts = 50) => {
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(Math.random() * (window.innerWidth - SQUARE_SIZE));
      const y = Math.floor(Math.random() * (window.innerHeight - SQUARE_SIZE));

      const overlaps = existingSquares.some(sq => {
        const xOverlap = Math.abs(sq.x - x) < SQUARE_SIZE;
        const yOverlap = Math.abs(sq.y - y) < SQUARE_SIZE;
        return xOverlap && yOverlap;
      });

      if (!overlaps) {
        return { x, y };
      }
    }
    return null;
  };

  const getRemoveTime = (boxNumber) => {
    if (boxNumber <= 10) {
      // 1~10번: 7→4.5초
      const step = boxNumber - 1; 
      return REMOVE_START_PHASE1 - (REMOVE_PHASE1_DEC * step);
    } else if (boxNumber <= 25) {
      // 11~25번: 5→2.5초
      const step = boxNumber - 10; 
      return REMOVE_START_PHASE2 - (REMOVE_PHASE2_DEC * (step - 1));
    } else {
      // 26~50번: 2.5초 고정
      return REMOVE_PHASE3;
    }
  };

  const spawnBoxes = (currentCount, delay) => {
    if (currentCount > TOTAL_SQUARES) {
      setAllSpawned(true);
      return;
    }

    const pos = getNonOverlappingPosition(squares);
    if (!pos) {
      // 위치 못 찾으면 스킵
      const nextDelay = getNextDelay(currentCount, delay);
      setTimeout(() => {
        spawnBoxes(currentCount + 1, nextDelay);
      }, nextDelay);
      return;
    }

    const lifeTime = getRemoveTime(currentCount) * 1000; 
    setSquares(prev => [...prev, { id: currentCount, x: pos.x, y: pos.y, bursting: false }]);

    timersRef.current[currentCount] = setTimeout(() => {
      removeBox(currentCount);
    }, lifeTime);

    const nextDelay = getNextDelay(currentCount, delay);
    setTimeout(() => {
      spawnBoxes(currentCount + 1, nextDelay);
    }, nextDelay);
  };

  const removeBox = (id) => {
    setSquares(prev => prev.filter(sq => sq.id !== id));
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id]);
      delete timersRef.current[id];
    }
  };

  const burstBox = (id) => {
    setClickedCount(prev => prev + 1);

    setSquares(prev => {
      const target = prev.find(sq => sq.id === id);
      if (!target || target.bursting) return prev; 

      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }

      return prev.map(sq =>
        sq.id === id ? { ...sq, bursting: true } : sq
      );
    });

    setTimeout(() => {
      removeBox(id);
    }, 300);
  };

  const getNextDelay = (currentCount, delay) => {
    let nextDelay = delay;
    if (currentCount < 10) {
      // 1~10번: 2초->0.9초
      nextDelay = Math.max(MID_DELAY, delay - PHASE1_DECREMENT);
    } else if (currentCount >= 10 && currentCount < 25) {
      // 10~25번: 1.0초->0.4초
      nextDelay = Math.max(LOWER_DELAY, delay - PHASE2_DECREMENT);
    } else {
      // 25~50번: 0.4초 고정
      nextDelay = FINAL_DELAY;
    }
    return nextDelay;
  };

  const handleRetry = () => {
    // 상태 초기화
    setShowButton(true);
    setFadeOut(false);
    setCountdown(null);
    setShowGo(false);
    setSquares([]);
    setClickedCount(0);
    setGameOver(false);
    setAllSpawned(false);
    setShowRetry(false);

    // 타이머들 초기화
    for (const id in timersRef.current) {
      clearTimeout(timersRef.current[id]);
    }
    timersRef.current = {};
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      position: 'relative', 
      overflow: 'hidden',
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      fontSize: '2rem'
    }}>
      {showButton && (
        <button 
          onClick={handleStart} 
          style={{
            fontSize: '1.5rem', 
            padding: '10px 20px', 
            opacity: fadeOut ? 0 : 1,
            transition: 'opacity 0.5s ease'
          }}
        >
          시작
        </button>
      )}
      {!showButton && countdown !== null && (countdown > 0 ? countdown : (showGo && 'GO!'))}

      {gameOver && (
        <div style={{ position: 'absolute', top: '50px', fontSize: '2rem', color: '#f00', textAlign: 'center' }}>
          게임 종료!<br/>
          클릭 성공: {clickedCount}개
        </div>
      )}

      {showRetry && (
        <button 
          onClick={handleRetry} 
          style={{ position: 'absolute', top: '150px', fontSize: '1.5rem', padding: '10px 20px' }}
        >
          Retry
        </button>
      )}

      {squares.map((sq) => (
        <div 
          key={sq.id}
          onClick={() => burstBox(sq.id)}
          style={{
            position: 'absolute',
            width: `${SQUARE_SIZE}px`,
            height: `${SQUARE_SIZE}px`,
            backgroundColor: '#000',
            left: `${sq.x}px`,
            top: `${sq.y}px`,
            transition: 'transform 0.3s ease, opacity 0.3s ease',
            transform: sq.bursting ? 'scale(1.5)' : 'scale(1)',
            opacity: sq.bursting ? 0 : 1
          }}
        ></div>
      ))}
    </div>
  );
}

export default App;
