"use client";

import { useEffect, useRef, useState } from "react";

export default function DinoGame({
  width = 900,
  height = 30,
  autoStart = true,
  onGameOver,
  playerImage = "/images/tree.svg",
  obstacleImage = "/images/fire.svg",
}) {
  const canvasRef = useRef(null);
  const requestRef = useRef(null);

  const [running, setRunning] = useState(autoStart);

  const dino = useRef({
    x: 40,
    y: 0,
    vy: 0,
    size: 5,
    jumping: false,
  });

  const groundY = height - 5;
  const gravity = 0.6;

  const obstacles = useRef([]);
  const frame = useRef(0);
  const nextObstacleFrame = useRef(90); // 下一个障碍物出现的帧数

  const dinoImage = useRef(null);
  const obstacleImageRef = useRef(null);

  useEffect(() => {
    if (playerImage) {
      const img = new Image();
      img.src = playerImage;
      dinoImage.current = img;
    }

    if (obstacleImage) {
      const img = new Image();
      img.src = obstacleImage;
      obstacleImageRef.current = img;
    }
  }, [playerImage, obstacleImage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const loop = () => {
      if (!running) return;

      ctx.clearRect(0, 0, width, height);

      drawGround(ctx);
      updateDino();
      updateObstacles();
      drawDino(ctx);
      drawObstacles(ctx);

      if (checkCollision()) {
        setRunning(false);
        onGameOver?.();
        return;
      }

      frame.current++;
      requestRef.current = requestAnimationFrame(loop);
    };

    requestRef.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(requestRef.current);
  }, [running, width, height, onGameOver]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!running) {
          dino.current = {
            x: 40,
            y: 0,
            vy: 0,
            size: 5,
            jumping: false,
          };
          obstacles.current = [];
          frame.current = 0;
          nextObstacleFrame.current = 90;
          setRunning(true);
        } else {
          jump();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [running]);

  const jump = () => {
    if (!dino.current.jumping && running) {
      dino.current.vy = 10; // 正数，向上跳
      dino.current.jumping = true;
    }
  };

  const updateDino = () => {
    dino.current.y += dino.current.vy; // y增加表示向上
    dino.current.vy -= gravity; // 重力向下拉，减少vy

    // 回到地面
    if (dino.current.y <= 0) {
      dino.current.y = 0;
      dino.current.vy = 0;
      dino.current.jumping = false;
    }
  };

  const updateObstacles = () => {
    // 随机间隔生成障碍物
    if (frame.current >= nextObstacleFrame.current) {
      obstacles.current.push({
        x: width,
        w: 8 + Math.random() * 12, // 随机宽度 8-20
        h: 10 + Math.random() * 15, // 随机高度 10-25
      });
      // 设置下一个障碍物的出现时间（60-120帧，即1-2秒）
      nextObstacleFrame.current = frame.current + 60 + Math.random() * 60;
    }

    obstacles.current.forEach((o) => (o.x -= 4));
    obstacles.current = obstacles.current.filter((o) => o.x + o.w > 0);
  };

  const checkCollision = () => {
    return obstacles.current.some((o) => {
      const playerSize = dino.current.size * 4;

      return (
        dino.current.x < o.x + o.w &&
        dino.current.x + playerSize > o.x &&
        dino.current.y < o.h &&
        dino.current.y + playerSize > 0
      );
    });
  };

  const drawGround = (ctx) => {
    ctx.fillStyle = "#999";
    ctx.fillRect(0, groundY, width, 1);
  };

  const drawDino = (ctx) => {
    const playerSize = dino.current.size * 4;

    if (dinoImage.current && dinoImage.current.complete) {
      ctx.drawImage(
        dinoImage.current,
        dino.current.x,
        groundY - dino.current.y - playerSize, // 从地面向上
        playerSize,
        playerSize
      );
    } else {
      ctx.fillStyle = "#111";
      ctx.fillRect(
        dino.current.x,
        groundY - dino.current.y - playerSize,
        playerSize,
        playerSize
      );
    }
  };

  const drawObstacles = (ctx) => {
    obstacles.current.forEach((o) => {
      if (obstacleImageRef.current && obstacleImageRef.current.complete) {
        ctx.drawImage(
          obstacleImageRef.current,
          o.x,
          groundY - o.h, // 从地面向上
          o.w,
          o.h
        );
      } else {
        ctx.fillStyle = "#555";
        ctx.fillRect(o.x, groundY - o.h, o.w, o.h);
      }
    });
  };

  return (
    <div className="w-4/5 min-h-[50px] mx-auto">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="block w-full h-auto"
        onClick={jump}
      />
    </div>
  );
}